import { useSyncExternalStore } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getToken, suscribirSesion } from '../services/auth';

export default function RutaProtegida() {
  const token = useSyncExternalStore(suscribirSesion, getToken, () => null);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
