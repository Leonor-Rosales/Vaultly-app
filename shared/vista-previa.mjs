import tipos from './tipos-vista-previa.json' with { type: 'json' };

export const limiteTexto = 128 * 1024;
const extensionesTexto = new Set('txt md markdown json jsonl ndjson js jsx mjs cjs ts tsx css scss html htm xml yaml yml toml ini log sql py java c h cpp hpp cs go rs rb php sh bash ps1 kt swift vue'.split(' '));
const mimeTexto = new Set(['application/json', 'application/javascript', 'application/xml', 'application/yaml', 'application/sql', 'application/typescript', 'application/x-sh']);

export function formatoVistaPrevia(nombre, tipo) {
  const mime = tipo.toLowerCase().split(';')[0].trim();
  const ext = /\.([^.]+)$/.exec(nombre.toLowerCase())?.[1];
  if (['zip', 'exe', 'msi', 'dll', 'rar', '7z', 'tar', 'gz'].includes(ext)) return null;
  if (tipos.includes(mime)) return mime === 'application/pdf' ? 'pdf' : 'imagen';
  // Algunos navegadores identifican CSV como Excel y el código como binario genérico.
  const generico = !mime || ['application/octet-stream', 'application/vnd.ms-excel'].includes(mime);
  if (mime === 'text/tab-separated-values' || (ext === 'tsv' && (generico || mime.startsWith('text/')))) return 'tsv';
  if (['text/csv', 'application/csv'].includes(mime) || (ext === 'csv' && (generico || mime.startsWith('text/')))) return 'csv';
  if (mime.startsWith('text/') || mimeTexto.has(mime) || /\+(json|xml)$/.test(mime)) return 'texto';
  if ((generico || mime === 'video/mp2t') && extensionesTexto.has(ext)) return 'texto';
  return null;
}
