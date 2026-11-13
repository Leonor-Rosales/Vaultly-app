const campos = ['id','version','nombre','precio_mensual','moneda','cuota_storage_gb','limite_descargas','permite_carpetas_publicas','activo','promocion_precio','promocion_inicio','promocion_fin','promocion_tipo','promocion_porcentaje','inactivo_desde','archivado_en'];
const fotoPlan = plan => plan ? Object.fromEntries(campos.map(campo => [campo,plan[campo]])) : null;
module.exports = { fotoPlan };
