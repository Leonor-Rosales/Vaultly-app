import tipos from './tipos-vista-previa.json' with { type: 'json' };

export const limiteTexto = 128 * 1024;
const extensionesTexto = new Set('txt md markdown json jsonl ndjson js jsx mjs cjs ts tsx css scss html htm xml yaml yml toml ini log sql py java c h cpp hpp cs go rs rb php sh bash ps1 kt swift vue'.split(' '));
const mimeTexto = new Set(['application/json', 'application/javascript', 'application/xml', 'application/yaml', 'application/sql', 'application/typescript', 'application/x-sh']);

const medios = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', oga: 'audio/ogg', ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', weba: 'audio/webm',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' };
const tiposMedio = new Set([...Object.values(medios), 'audio/x-wav', 'audio/x-m4a', 'audio/x-flac', 'audio/mp3']);

export function tipoMultimedia(nombre, tipo) {
  const mime = tipo.toLowerCase().split(';')[0].trim();
  if (tiposMedio.has(mime)) return mime;
  const ext = nombre.toLowerCase().split('.').pop();
  return (!mime || mime === 'application/octet-stream') && Object.hasOwn(medios, ext) ? medios[ext] : null;
}

export function formatoVistaPrevia(nombre, tipo) {
  const mime = tipo.toLowerCase().split(';')[0].trim();
  const ext = /\.([^.]+)$/.exec(nombre.toLowerCase())?.[1];
  if (['zip', 'exe', 'msi', 'dll', 'rar', '7z', 'tar', 'gz'].includes(ext)) return null;
  if (tipos.includes(mime)) return mime === 'application/pdf' ? 'pdf' : 'imagen';
  const medio = tipoMultimedia(nombre, tipo);
  if (medio) return medio.startsWith('audio/') ? 'audio' : 'video';
  // Algunos navegadores identifican CSV como Excel y el código como binario genérico.
  const generico = !mime || ['application/octet-stream', 'application/vnd.ms-excel'].includes(mime);
  if (mime === 'text/tab-separated-values' || (ext === 'tsv' && (generico || mime.startsWith('text/')))) return 'tsv';
  if (['text/csv', 'application/csv'].includes(mime) || (ext === 'csv' && (generico || mime.startsWith('text/')))) return 'csv';
  if (mime.startsWith('text/') || mimeTexto.has(mime) || /\+(json|xml)$/.test(mime)) return 'texto';
  if ((generico || mime === 'video/mp2t') && extensionesTexto.has(ext)) return 'texto';
  return null;
}
