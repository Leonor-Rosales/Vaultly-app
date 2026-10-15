// Regla de dominio compartida. Longitud en puntos de código Unicode, tras normalizar.
export function normalizarEtiquetas(entrada) {
  if (!Array.isArray(entrada)) throw new Error('Las etiquetas deben ser un array de textos');
  const nombres = entrada.map(valor => {
    if (typeof valor !== 'string') throw new Error('Cada etiqueta debe ser un texto');
    if (/\p{Cc}/u.test(valor)) throw new Error('Las etiquetas no permiten caracteres de control');
    const nombre = valor.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase().normalize('NFC');
    if (!nombre) throw new Error('Las etiquetas no pueden estar vacías');
    if ([...nombre].length > 30) throw new Error('Cada etiqueta admite máximo 30 caracteres');
    return nombre;
  });
  const unicas = [...new Set(nombres)];
  if (unicas.length > 5) throw new Error('Cada archivo admite máximo 5 etiquetas distintas');
  return unicas;
}

export function incluirPendiente(etiquetas, pendiente) {
  return normalizarEtiquetas(pendiente === '' ? etiquetas : [...etiquetas, pendiente]);
}
