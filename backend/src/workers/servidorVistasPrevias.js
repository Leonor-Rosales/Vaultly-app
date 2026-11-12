const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');

// Una petición revisa como máximo un trabajo de la cola. Este servicio no recibe
// archivos, claves R2 ni URLs del cliente, y no inicia migraciones ni temporizadores.
function crearServidorVistasPrevias({ procesarSiguiente, secreto, registrarError = console.error }) {
  if (!secreto || secreto.length < 32) throw new Error('VISTAS_PREVIAS_SECRET debe tener al menos 32 caracteres');
  const esperado = Buffer.from(`Bearer ${secreto}`);
  let procesando = false;
  const responder = (res, estado, datos) => {
    if (res.destroyed) return;
    res.writeHead(estado, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(datos));
  };

  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      return responder(res, 200, { servicio: 'vistas-previas', estado: 'DISPONIBLE' });
    }
    if (req.url !== '/internal/procesar-vista-previa') return responder(res, 404, { error: 'Ruta no encontrada' });
    const recibido = Buffer.from(req.headers.authorization || '');
    if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
      return responder(res, 401, { error: 'No autorizado' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return responder(res, 405, { error: 'Método no permitido' });
    }
    if (procesando) return responder(res, 409, { error: 'Conversor ocupado; reintentar' });
    procesando = true;
    req.resume();
    try {
      await procesarSiguiente();
      // El resultado de la conversión se consulta en la cola; una revisión puede
      // encontrarla vacía, ocupada por otra instancia o dejar un reintento pendiente.
      responder(res, 200, { revisionCompletada: true });
    } catch (error) {
      registrarError('No se pudo revisar la cola de vistas previas:', error.message);
      responder(res, 503, { error: 'No se pudo revisar la cola; reintentar' });
    } finally {
      procesando = false;
    }
  });
}

module.exports = { crearServidorVistasPrevias };
