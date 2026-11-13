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
    listarAuditoria: ({ pagina = '1', accion = '', q = '', desde = '', hasta = '' } = {}) => {
      if (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina) || typeof q !== 'string' || q.length > 100 || typeof accion !== 'string' || (accion && !/^(?:(PLAN|ADMIN)_(CREADO|EDITADO|ACTIVADO|DESACTIVADO)|PLAN_(ARCHIVADO|ELIMINADO))$/.test(accion))) throw new ErrorApp('Filtros de auditoría inválidos', 400);
      const fechaValida = valor => typeof valor === 'string' && (valor === '' || (/^\d{4}-\d{2}-\d{2}$/.test(valor) && valor >= '0001-01-01' && valor <= '9998-12-31' && Number.isFinite(Date.parse(`${valor}T00:00:00Z`)) && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor));
      if (!fechaValida(desde) || !fechaValida(hasta)) throw new ErrorApp('Indica fechas válidas para consultar la auditoría.', 400);
      if (desde && hasta && desde > hasta) throw new ErrorApp('La fecha Desde no puede ser posterior a Hasta.', 400);
      return repo.listarAuditoria({ pagina: Number(pagina), accion, q: q.trim(), desde, hasta });
    },
    async guardarPlan(actor, id, datos) {
      const d = validarPlan(datos);
      return repo.transaccion('plan', async tx => {
        await autorizado(tx, actor);
        let anterior = null;
        if (id) {
          anterior = await tx.plan(id);
          if (!anterior) throw new ErrorApp('Plan no encontrado', 404);
          if (anterior.archivado_en) throw new ErrorApp('Este plan ya fue retirado automáticamente del listado. Su historial se conserva en Auditoría.', 409, 'PLAN_ARCHIVADO');
          if (!Number.isInteger(datos.version) || datos.version !== anterior.version) {
            throw new ErrorApp('Otro administrador modificó este plan. Recarga el plan antes de guardar; tus cambios no se aplicaron.', 409, 'PLAN_DESACTUALIZADO');
          }
          protegerPlan(anterior, d, await tx.usado(id));
        }
        // Un cliente antiguo que no envía estos campos no debe borrar una promoción.
        for (const campo of ['promocion_precio','promocion_inicio','promocion_fin']) if (d[campo] === undefined) d[campo] = anterior?.[campo] == null ? null : campo === 'promocion_precio' ? Number(anterior[campo]) : new Date(anterior[campo]).toISOString();
        // Conservar el tipo de ofertas existentes si un cliente anterior no lo envía.
        if (datos.promocion_tipo === undefined && anterior?.promocion_tipo && d.promocion_precio != null) {
          d.promocion_tipo = anterior.promocion_tipo;
          d.promocion_porcentaje = anterior.promocion_porcentaje == null ? null : Number(anterior.promocion_porcentaje);
        }
        Object.assign(d, validarPlan(d));
        // Se permite retirar un plan gratuito antiguo, sin cambiar sus condiciones.
        const legadoRetirado = anterior && Number(anterior.precio_mensual) === 0 && !d.activo
          && ['nombre','cuota_storage_gb','limite_descargas','permite_carpetas_publicas'].every(k => anterior[k] === d[k]);
        if (!legadoRetirado && d.nombre.toLowerCase() === 'free' && (d.nombre !== 'Free' || d.precio_mensual !== 0 || !d.activo)) {
          throw new ErrorApp('Free debe conservar su nombre, precio cero y estado activo.', 400, 'PLAN_FREE_PROTEGIDO');
        }
        if (d.nombre !== 'Free' && d.precio_mensual === 0 && !legadoRetirado) {
          throw new ErrorApp('Solo el plan Free puede tener precio cero. Indica un precio mayor que cero.', 400, 'PRECIO_CERO_NO_PERMITIDO');
        }
        const nuevo = await tx.guardarPlan(id, d, anterior?.version);
        if (!nuevo) throw new ErrorApp('El plan cambió. Recárgalo antes de guardar.', 409, 'PLAN_DESACTUALIZADO');
        const accion = !anterior ? 'PLAN_CREADO' : anterior.activo !== nuevo.activo ? (nuevo.activo ? 'PLAN_ACTIVADO' : 'PLAN_DESACTIVADO') : 'PLAN_EDITADO';
        await tx.auditarPlan(actor, accion, anterior, nuevo);
        if (anterior?.activo && !nuevo.activo) await tx.encolarAvisosRetiro(nuevo);
        return nuevo;
      });
    },
    async guardarAdministrador(actor, id, datos) {
      const d = validarAdministrador(datos, !id);
      const hash = id ? undefined : await hashear(datos.password);
      return repo.transaccion('administrador', async tx => {
        await autorizado(tx, actor);
        let anterior = null;
        if (id) {
          anterior = await tx.administrador(id);
          if (!anterior) throw new ErrorApp('Administrador no encontrado', 404);
          if (d.correo_electronico !== anterior.correo_electronico.trim().toLowerCase()) throw new ErrorApp('El titular debe verificar el nuevo correo desde Configuración', 409);
          if (anterior.estado_cuenta === 'ACTIVO') protegerAcceso(actor, id, datos.activo, await tx.activos());
        }
        const nuevo = await tx.guardarAdministrador(id, d, hash);
        const accion = !anterior ? 'ADMIN_CREADO' : anterior.estado_cuenta !== nuevo.estado_cuenta ? (nuevo.estado_cuenta === 'ACTIVO' ? 'ADMIN_ACTIVADO' : 'ADMIN_DESACTIVADO') : 'ADMIN_EDITADO';
        await tx.auditarAdministrador(actor, accion, anterior, nuevo);
        return nuevo;
      });
    },
  };
}
module.exports = { crearCasosAdministracion };
