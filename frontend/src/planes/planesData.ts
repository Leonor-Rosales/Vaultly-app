export type Moneda = 'USD' | 'GTQ';
export interface Plan {
  moneda?: Moneda;
  promocionTexto?: string;
  precioHabitual?: number;
  promocionHasta?: string;
  version: number;
  id: string;
  nombre: string;
  precio: number; // importe mensual en la moneda del plan
  almacenamientoGb: number;
  descargasMensuales: number | null; // null = ilimitadas
}

export const formatPrecio = (monto: number, moneda: Moneda = 'USD'): string => `${moneda === 'GTQ' ? 'Q' : 'US$'}${monto.toFixed(2)}`;

export const textoDescargas = (plan: Plan): string =>
  plan.descargasMensuales === null
    ? "Ilimitadas"
    : `${plan.descargasMensuales} descargas mensuales`;
