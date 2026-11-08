function crearPapelera(repo, almacenamiento) {
  let limpiando = false;
  return {
    listar: repo.listar,
    enviarArchivo: (id, usuario) => repo.enviar(usuario,'archivo',id),
    enviarCarpeta: (id, usuario) => repo.enviar(usuario,'carpeta',id),
    restaurar: repo.restaurar,
    purgar: repo.purgar,
    async limpiar() {
      if (limpiando) return;
      limpiando = true;
      try {
        for (const item of await repo.vencidos()) await repo.purgar(item.usuario_id,item.id);
        for (const {objeto} of await repo.pendientes()) {
          try {
            await almacenamiento.eliminar(objeto);
            await repo.confirmarBorrado(objeto);
          } catch (error) { console.error('Borrado de objeto pendiente:', error.message); }
        }
      } catch (error) { console.error('No se pudo limpiar la papelera:', error.message); }
      finally { limpiando = false; }
    },
  };
}
module.exports = {crearPapelera};
