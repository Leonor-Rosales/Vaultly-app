const { ErrorApp } = require('../domain/errores');
const { validarPlan, validarAdministrador, protegerAcceso, protegerPlan } = require('../domain/administracion');
function crearCasosAdministracion({ repo, hashear }) {
  async function autorizado(tx, actor) {
    const usuario = await tx.actor(actor);
    if (usuario?.rol !== 'ADMIN' || usuario.estado_cuenta !== 'ACTIVO') throw new ErrorApp('No tienes permiso para esta acción', 403);
  }
  return {
    listarPlanes: () => repo.listarPlanes(),
    listarAdministradores: () => repo.listarAdministradores(),
    async guardarPlan(actor, id, datos) {
      const d = validarPlan(datos);
      return repo.transaccion('plan', async tx => {
        await autorizado(tx, actor);
        if (id) {
          const anterior = await tx.plan(id);
          if (!anterior) throw new ErrorApp('Plan no encontrado', 404);
          protegerPlan(anterior, d, await tx.usado(id));
        }
        return tx.guardarPlan(id, d);
      });
    },
    async guardarAdministrador(actor, id, datos) {
      const d = validarAdministrador(datos, !id);
      const hash = id ? undefined : await hashear(datos.password);
      return repo.transaccion('administrador', async tx => {
        await autorizado(tx, actor);
        if (id) {
          const anterior = await tx.administrador(id);
          if (!anterior) throw new ErrorApp('Administrador no encontrado', 404);
          if (d.correo_electronico !== anterior.correo_electronico.trim().toLowerCase()) throw new ErrorApp('El titular debe verificar el nuevo correo desde Configuración', 409);
          if (anterior.estado_cuenta === 'ACTIVO') protegerAcceso(actor, id, datos.activo, await tx.activos());
        }
        return tx.guardarAdministrador(id, d, hash);
      });
    },
  };
}
module.exports = { crearCasosAdministracion };
