const repo = require('../infrastructure/bibliotecarepositorio');

class ErrorPublico extends Error {
  constructor(mensaje, status = 400, codigo = 'PARAMETRO_INVALIDO') {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const TIPOS = ['documentos', 'imagenes', 'videos', 'audio', 'comprimidos', 'otros'];
const ORDENES = ['recientes', 'antiguos', 'nombre_asc', 'tamanio_desc', 'tamanio_asc'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_Q = 100;
const MAX_ETIQUETAS = 50;
const MAX_INT4 = 2147483647;
const MAX_PAGINA = 1000000;
const MAX_LIMITE = 20;

function unico(valor, nombre) {
  if (Array.isArray(valor)) throw new ErrorPublico(`El parámetro ${nombre} solo admite un valor`);
  return valor;
}

function entero(valor, nombre, max) {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > max) {
    throw new ErrorPublico(`El parámetro ${nombre} debe ser un entero positivo`);
  }
  return Number(valor);
}

function texto(valor, nombre) {
  const v = unico(valor, nombre);
  if (v === undefined) return '';
  if (typeof v !== 'string') throw new ErrorPublico(`El parámetro ${nombre} no es válido`);
  const limpio = v.trim();
  if (limpio.length > MAX_Q) throw new ErrorPublico(`El parámetro ${nombre} es demasiado largo`);
  return limpio;
}

function validarArchivos(query) {
  const q = texto(query.q, 'q');

  const tipo = unico(query.tipo, 'tipo');
  if (tipo !== undefined && tipo !== '' && !TIPOS.includes(tipo)) {
    throw new ErrorPublico('El parámetro tipo no es válido');
  }

  const crudas = query.etiqueta_id === undefined ? [] : [].concat(query.etiqueta_id);
  if (crudas.length > MAX_ETIQUETAS) throw new ErrorPublico('Demasiadas etiquetas seleccionadas');
  const etiquetaIds = [...new Set(crudas.map((v) => entero(v, 'etiqueta_id', MAX_INT4)))];

  const autorId = unico(query.autor_id, 'autor_id');
  if (autorId !== undefined && autorId !== '' && !UUID_RE.test(autorId)) {
    throw new ErrorPublico('El parámetro autor_id debe ser un UUID válido');
  }

  const orden = unico(query.orden, 'orden') || 'recientes';
  if (!ORDENES.includes(orden)) throw new ErrorPublico('El parámetro orden no es válido');

  const pagina = query.pagina === undefined ? 1 : entero(unico(query.pagina, 'pagina'), 'pagina', MAX_PAGINA);

  if (query.por_pagina !== undefined && unico(query.por_pagina, 'por_pagina') !== String(repo.POR_PAGINA)) {
    throw new ErrorPublico(`El parámetro por_pagina debe ser ${repo.POR_PAGINA}`);
  }

  return { q, tipo: tipo || undefined, etiquetaIds, autorId: autorId || undefined, orden, pagina };
}

function validarOpciones(query) {
  const q = texto(query.q, 'q');
  const limite = query.limite === undefined
    ? MAX_LIMITE
    : entero(unico(query.limite, 'limite'), 'limite', MAX_LIMITE);
  return { q, limite };
}

const listarArchivosBiblioteca = (query) => repo.listarArchivos(validarArchivos(query));
const listarEtiquetasBiblioteca = (query) => repo.listarEtiquetas(validarOpciones(query));
const listarAutoresBiblioteca = (query) => repo.listarAutores(validarOpciones(query));

module.exports = {
  ErrorPublico,
  validarArchivos,
  validarOpciones,
  listarArchivosBiblioteca,
  listarEtiquetasBiblioteca,
  listarAutoresBiblioteca,
};