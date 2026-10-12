require('dotenv').config(); // debe ir primero: el resto lee process.env al cargarse
const express = require('express');
const cors = require('cors');

const { PORT, FRONTEND_URL, BACKEND_URL } = require('./infrastructure/config');
const tokens = require('./infrastructure/tokens');
const { crearCasosAuth } = require('./usecases/auth');
const { crearAuthController } = require('./controllers/authController');
const { crearAuthRoutes } = require('./controllers/authRoutes');
const { crearRequiereAuth } = require('./controllers/middleware/auth');
const requiereAuth = crearRequiereAuth(tokens.verificarTokenSesion);
const { crearCuotasRepositorio } = require('./infrastructure/cuotasRepositorio');
const { crearCasosCuotas } = require('./usecases/cuotas');
const { crearPlanesRoutes } = require('./controllers/planesRoutes');
const almacenamiento = require('./infrastructure/almacenamientoMinio');
const cuotas = crearCasosCuotas({ repo: crearCuotasRepositorio(require('./infrastructure/db')), almacenamiento });
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
app.use('/api/archivos', archivosRoutes);
app.use('/api/planes', crearPlanesRoutes(cuotas, requiereAuth));

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
