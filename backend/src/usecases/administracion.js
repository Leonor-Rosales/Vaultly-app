const { ErrorApp } = require('../domain/errores');
const { validarPlan, validarAdministrador, protegerAcceso, protegerPlan } = require('../domain/administracion');
function crearCasosAdministracion({ repo, hashear }) {
  async function autorizado(tx, actor) {
    const usuario = await tx.actor(actor);
    if (usuario?.rol !== 'ADMIN' || usuario.estado_cuenta !== 'ACTIVO') throw new ErrorApp('No tienes permiso para esta acción', 403);
  }
  return {
    listarPagos: () => repo.listarPagos(),
    listarPlanes: () => repo.listarPlanes(),
    listarAdministradores: () => repo.listarAdministradores(),
    async guardarPlan(actor, id, datos) {
      const d = validarPlan(datos);
      return repo.transaccion('plan', async tx => {
        await autorizado(tx, actor);
        let anterior = null;
        if (id) {
          anterior = await tx.plan(id);
          if (!anterior) throw new ErrorApp('Plan no encontrado', 404);
          if (!Number.isInteger(datos.version) || datos.version !== anterior.version) {
            throw new ErrorApp('Otro administrador modificó este plan. Recarga el plan antes de guardar; tus cambios no se aplicaron.', 409, 'PLAN_DESACTUALIZADO');
          }
          protegerPlan(anterior, d, await tx.usado(id));
        }
        // Se permite retirar un plan gratuito antiguo, sin cambiar sus condiciones.
        const legadoRetirado = anterior && Number(anterior.precio_mensual) === 0 && !d.activo
          && ['nombre','cuota_storage_gb','limite_descargas','permite_carpetas_publicas'].every(k => anterior[k] === d[k]);
        if (!legadoRetirado && d.nombre.toLowerCase() === 'free' && (d.nombre !== 'Free' || d.precio_mensual !== 0 || !d.activo)) {
          throw new ErrorApp('Free debe conservar su nombre, precio cero y estado activo.', 400, 'PLAN_FREE_PROTEGIDO');
        }
        if (d.nombre !== 'Free' && d.precio_mensual === 0 && !legadoRetirado) {
          throw new ErrorApp('Solo el plan Free puede tener precio cero. Indica un precio mayor que Q0.00.', 400, 'PRECIO_CERO_NO_PERMITIDO');
        }
        const nuevo = await tx.guardarPlan(id, d, anterior?.version);
        if (!nuevo) throw new ErrorApp('El plan cambió. Recárgalo antes de guardar.', 409, 'PLAN_DESACTUALIZADO');
        const accion = !anterior ? 'PLAN_CREADO' : anterior.activo !== nuevo.activo ? (nuevo.activo ? 'PLAN_ACTIVADO' : 'PLAN_DESACTIVADO') : 'PLAN_EDITADO';
        await tx.auditarPlan(actor, accion, anterior, nuevo);
        return nuevo;
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
