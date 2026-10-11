import policy from '../../../shared/password-policy.json' with { type: 'json' };

export function evaluarPassword(password: string) {
  const longitud = [...password].length;
  const requisitos = [
    { id: 'length', label: `Mínimo ${policy.minLength} caracteres`, cumple: longitud >= policy.minLength },
    ...policy.rules.map(({ id, label, pattern }) => ({ id, label, cumple: new RegExp(pattern, 'u').test(password) })),
  ];
  const demasiadoLarga = new TextEncoder().encode(password).length > policy.maxBytes;
  const valida = !demasiadoLarga && requisitos.every(({ cumple }) => cumple);
  const nivel = !valida ? 'Baja' : longitud < policy.highLength ? 'Media' : 'Alta';
  return { requisitos, valida, nivel, demasiadoLarga, barras: !valida ? 1 : nivel === 'Media' ? 2 : 3 };
}

export function errorPassword(password: string, confirmacion: string): string {
  const { requisitos, demasiadoLarga } = evaluarPassword(password);
  if (demasiadoLarga) return 'La contraseña es demasiado larga. Usa una más corta.';
  const pendientes = requisitos.filter(({ cumple }) => !cumple);
  if (pendientes.length) return pendientes.map(({ label }) => label).join('. ');
  if (password !== confirmacion) return 'Las contraseñas no coinciden';
  return '';
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
