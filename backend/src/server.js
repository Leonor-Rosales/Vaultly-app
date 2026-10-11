require('dotenv').config(); // debe ir primero: el resto lee process.env al cargarse
const express = require('express');
const cors = require('cors');

const { PORT, FRONTEND_URL } = require('./infrastructure/config');
const authRoutes = require('./controllers/authRoutes');
const { crearArchivosRoutes } = require('./controllers/archivosRoutes');
const { crearCasosArchivos } = require('./usecases/archivos');
const archivosRoutes = crearArchivosRoutes(crearCasosArchivos({
  repositorio: require('./infrastructure/archivoRepositorio'),
  almacenamiento: require('./infrastructure/almacenamientoMinio'),
}));

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/archivos', archivosRoutes);

app.listen(PORT, () => console.log(`Backend en http://localhost:${PORT}`));
