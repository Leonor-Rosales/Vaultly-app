import type { ArchivoPublico, Orden } from './tipos.ts';

// Contrato Strategy: cada criterio compara dos archivos sin modificarlos.
export type EstrategiaOrden = (a: ArchivoPublico, b: ArchivoPublico) => number;

const porFecha: EstrategiaOrden = (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at);
const porNombre: EstrategiaOrden = (a, b) =>
  a.nombre_original.localeCompare(b.nombre_original, 'es', { sensitivity: 'base' });
const porTamanio: EstrategiaOrden = (a, b) => {
  const x = BigInt(a.tamanio_bytes), y = BigInt(b.tamanio_bytes);
  return x < y ? -1 : x > y ? 1 : 0;
};

const estrategias: Readonly<Record<Orden, EstrategiaOrden>> = {
  recientes: (a, b) => -porFecha(a, b),
  antiguos: porFecha,
  nombre_asc: porNombre,
  tamanio_desc: (a, b) => -porTamanio(a, b),
  tamanio_asc: porTamanio,
};

export function seleccionarEstrategiaOrden(orden: Orden): EstrategiaOrden {
  const comparar = estrategias[orden];
  // El desempate compartido conserva una paginación determinista en todos los criterios.
  return (a, b) => comparar(a, b) || a.id.localeCompare(b.id);
}
