import policy from '../../../shared/usage-policy.json' with { type: 'json' };

export function porcentajeAlmacenamiento(usados: number, cuota: number): number {
  if (!Number.isFinite(usados) || !Number.isFinite(cuota) || cuota <= 0) return 0;
  return Math.max(0, usados / cuota * 100);
}

export function textoPorcentaje(porcentaje: number): string {
  if (porcentaje > 0 && porcentaje < 0.1) return '< 0.1%';
  // No anunciar 100% mientras todavía queda espacio.
  return `${(Math.floor(porcentaje * 10) / 10).toLocaleString('es-GT', { maximumFractionDigits: 1 })}%`;
}

export function formatoBytes(bytes: number) {
  if (bytes >= policy.bytesPerGB) return `${(bytes / policy.bytesPerGB).toFixed(2)} GB`;
  if (bytes >= 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${bytes} B`;
}
export function mensajesAlertas(alertas: { almacenamiento: string | null; descargas: string | null }) {
  const mensajes = {
    almacenamiento: { PROXIMIDAD: 'Te queda poco espacio de almacenamiento.', LIMITE: 'Alcanzaste tu límite de almacenamiento.' },
    descargas: { PROXIMIDAD: 'Te quedan pocas descargas este mes.', LIMITE: 'Alcanzaste tu límite de descargas de este ciclo.' },
  };
  return (['almacenamiento', 'descargas'] as const).flatMap(tipo => {
    const nivel = alertas[tipo];
    return nivel === 'PROXIMIDAD' || nivel === 'LIMITE' ? [{ tipo, nivel, mensaje: mensajes[tipo][nivel] }] : [];
  });
}

export function avisosNuevos(
  alertas: { almacenamiento: string | null; descargas: string | null },
  usuario: string, ciclo: string, vistos: Set<string>,
) {
  return mensajesAlertas(alertas).flatMap(aviso => {
    const key = `cuota:${usuario}:${ciclo}:${aviso.tipo}:${aviso.nivel}`;
    if (vistos.has(key)) return [];
    vistos.add(key);
    return [{ ...aviso, key }];
  });
}
