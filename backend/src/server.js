require('dotenv').config(); // debe ir primero: el resto lee process.env al cargarse
const express = require('express');
const cors = require('cors');

const { PORT, FRONTEND_URL, BACKEND_URL } = require('./infrastructure/config');
const tokens = require('./infrastructure/tokens');
const { crearCasosAuth } = require('./usecases/auth');
const { crearAuthController } = require('./controllers/authController');
const { crearAuthRoutes } = require('./controllers/authRoutes');
const { crearRequiereAuth } = require('./controllers/middleware/auth');
const requiereAuth = crearRequiereAuth(tokens.verificarTokenSesion, require('./infrastructure/usuarioRepositorio').buscarPorIdConRol);
const { crearCuotasRepositorio } = require('./infrastructure/cuotasRepositorio');
const { crearCasosCuotas } = require('./usecases/cuotas');
const { crearPlanesRoutes } = require('./controllers/planesRoutes');
const almacenamiento = require('./infrastructure/almacenamientoMinio');
const cuotas = crearCasosCuotas({ repo: crearCuotasRepositorio(require('./infrastructure/db')), almacenamiento });
const { crearPagosRepositorio } = require('./infrastructure/pagosRepositorio');
const { crearCasosPagos } = require('./usecases/pagos');
const pagos = crearCasosPagos({ repo: crearPagosRepositorio(require('./infrastructure/db')) });
const casosAuth = crearCasosAuth({
  repo: require('./infrastructure/usuarioRepositorio'),
  contrasenas: require('./infrastructure/contrasenas'),
  tokens,
  correo: require('./infrastructure/mailer'),
  frontendUrl: FRONTEND_URL,
  backendUrl: BACKEND_URL,
});
const authRoutes = crearAuthRoutes(crearAuthController({ casos: casosAuth, frontendUrl: FRONTEND_URL }), requiereAuth);
const { crearArchivosRoutes } = require('./controllers/archivosRoutes');
const { crearCasosArchivos } = require('./usecases/archivos');
const archivosRoutes = crearArchivosRoutes(crearCasosArchivos({
  repositorio: require('./infrastructure/archivoRepositorio'),
  almacenamiento,
  cuotas,
}), requiereAuth);

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
const { crearCambioCorreoRoutes } = require('./controllers/cambioCorreoRoutes');
const { crearCasosCambioCorreo } = require('./usecases/cambioCorreo');
app.use('/api/admin/cambio-correo', crearCambioCorreoRoutes(crearCasosCambioCorreo({
  repo: require('./infrastructure/cambioCorreoRepositorio').crearCambioCorreoRepositorio(require('./infrastructure/db')),
  contrasenas: require('./infrastructure/contrasenas'),
  codigos: require('./infrastructure/codigosCorreo'),
  correo: require('./infrastructure/correoCambio').crearCorreoCambio(require('./infrastructure/mailer').enviarMensaje),
}), requiereAuth));
const { crearAdminRoutes } = require('./controllers/adminRoutes');
const { crearCasosAdministracion } = require('./usecases/administracion');
const { crearAdminRepositorio } = require('./infrastructure/adminRepositorio');
app.use('/api/admin', crearAdminRoutes(crearCasosAdministracion({
  repo: crearAdminRepositorio(require('./infrastructure/db')),
  hashear: require('./infrastructure/contrasenas').hashear,
}), requiereAuth));
app.use('/api/archivos', archivosRoutes);
app.use('/api/planes', crearPlanesRoutes(cuotas, requiereAuth, pagos));

const { crearBibliotecaRoutes } = require('./controllers/bibliotecaController');
const casosBiblioteca = require('./usecases/biblioteca');

app.use('/api/biblioteca', crearBibliotecaRoutes(casosBiblioteca, requiereAuth));

app.use(require('./controllers/jsonInvalido'));

// Recuperación idempotente. El bloqueo en PostgreSQL coordina varias instancias.
let recuperando = false;
async function recuperarReservas() {
  if (recuperando) return;
  recuperando = true;
  try {
    const resultado = await cuotas.recuperarReservas();
    if (resultado.fallos) console.error('Reservas pendientes de recuperación:', resultado.fallos);
  } catch (error) { console.error('No se pudieron recuperar reservas:', error.message); }
  finally { recuperando = false; }
}
setInterval(recuperarReservas, 60000).unref();
recuperarReservas();

app.listen(PORT, () => console.log(`Backend en http://localhost:${PORT}`));
