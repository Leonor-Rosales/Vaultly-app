export interface Plan {
  id: string;
  nombre: string;
  precio: number; // quetzales por mes
  almacenamientoGb: number;
  descargasMensuales: number | null; // null = ilimitadas
}

export const formatPrecio = (monto: number): string => `Q${monto.toFixed(2)}`;

export const textoDescargas = (plan: Plan): string =>
  plan.descargasMensuales === null
    ? "Ilimitadas"
    : `${plan.descargasMensuales} descargas mensuales`;
