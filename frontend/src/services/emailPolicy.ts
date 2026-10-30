import policy from '../../../shared/email-policy.json' with { type: 'json' };

export function errorCorreo(valor: string): string {
  const correo = valor.trim().toLowerCase();
  if (correo.length > 150 || correo.split('@')[0].length > 64 || !new RegExp(policy.pattern).test(correo)) return 'Introduce una dirección de correo válida, por ejemplo nombre@dominio.com.';
  const dominio = correo.split('@')[1];
  const sugerido = (policy.corrections as Record<string, string>)[dominio];
  return sugerido ? `Revisa el dominio: escribiste ${dominio}. ¿Querías decir ${sugerido}? Corrige la dirección antes de continuar.` : '';
}
