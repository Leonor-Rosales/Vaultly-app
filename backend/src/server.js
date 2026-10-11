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
  almacenamiento: require('./infrastructure/almacenamientoMinio'),
}), requiereAuth);

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/archivos', archivosRoutes);

app.listen(PORT, () => console.log(`Backend en http://localhost:${PORT}`));
