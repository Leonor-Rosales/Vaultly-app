// Datos de los planes tomados del mockup. Cuando el backend exponga los
// planes (la tabla "planes" ya existe en init-db), esto se reemplaza por una
// llamada en services/.

export interface Plan {
  id: string;
  nombre: string;
  precio: number; // quetzales por mes
  almacenamientoGb: number;
  descargasMensuales: number | null; // null = ilimitadas
}

export const PLANES: Plan[] = [
  { id: "free", nombre: "Free", precio: 0, almacenamientoGb: 5, descargasMensuales: 2 },
  { id: "basic-open", nombre: "Basic Open", precio: 50, almacenamientoGb: 15, descargasMensuales: 10 },
  { id: "pro-developer", nombre: "Pro Developer", precio: 150, almacenamientoGb: 50, descargasMensuales: null },
  { id: "max-vault", nombre: "Max Vault", precio: 200, almacenamientoGb: 100, descargasMensuales: null },
];

export const getPlan = (id: string | null | undefined): Plan | undefined =>
  PLANES.find((plan) => plan.id === id);

export const formatPrecio = (monto: number): string => `Q${monto.toFixed(2)}`;

export const textoDescargas = (plan: Plan): string =>
  plan.descargasMensuales === null
    ? "Ilimitadas"
    : `${plan.descargasMensuales} descargas mensuales`;
