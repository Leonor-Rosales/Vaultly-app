
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

// La cuota se consume cuando se envían las cabeceras.
// Si falla antes de ese punto, se devuelve la reserva.
async function transmitirDescarga(descarga, res) {
  const { archivo, stream, iniciar, cancelar, registrarDescarga } = descarga;

  const desconectar = () => stream.destroy(new Error('Cliente desconectado'));
  res.once('close', desconectar);

  try {
    const iterator = stream[Symbol.asyncIterator]();
    const primero = await iterator.next();

    if (res.destroyed) throw new Error('Cliente desconectado');

    await iniciar();

    if (res.destroyed) throw new Error('Cliente desconectado');

    res.setHeader('Content-Type', archivo.tipo_mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombre_original)}`
    );

    res.flushHeaders();

    await pipeline(
      Readable.from((async function* () {
        if (!primero.done) yield primero.value;

        for (;;) {
          const siguiente = await iterator.next();
          if (siguiente.done) break;
          yield siguiente.value;
        }
      })()),
      res
    );

    // Contar solo cuando la transmisión finaliza correctamente.
    if (registrarDescarga) {
      try {
        await registrarDescarga();
      } catch (error) {
        console.error('No se pudo actualizar el contador de descargas:', error);
      }
    }
  } catch (error) {
    if (!res.headersSent) await cancelar();
    throw error;
  } finally {
    res.off('close', desconectar);
    stream.destroy();
  }
}

module.exports = { transmitirDescarga };
