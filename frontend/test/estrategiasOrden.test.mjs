import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seleccionarEstrategiaOrden } from '../src/biblioteca/estrategiasOrden.ts';
import { crearBibliotecaDemo } from '../src/biblioteca/demo.ts';
import { leerConsulta } from '../src/biblioteca/estado.ts';
import { ordenes } from '../src/biblioteca/tipos.ts';

const archivo = (id, nombre, bytes, fecha) => Object.freeze({
  id, nombre_original: nombre, tamanio_bytes: bytes, created_at: fecha,
  tipo_mime: 'application/pdf', descargas: 0,
  autor: { id: 'autor', nombre_completo: 'Ana' }, etiquetas: [],
});
const archivos = Object.freeze([
  archivo('b', 'Beta.pdf', '9007199254740993', '2026-10-02T12:00:00Z'),
  archivo('a', 'Alfa.pdf', '9007199254740992', '2026-10-01T12:00:00Z'),
  archivo('c', 'Zeta.pdf', '10', '2026-10-03T12:00:00Z'),
]);

test('Strategy: cada criterio conserva el orden esperado y la precisión de BIGINT', async () => {
  const esperados = {
    recientes: ['c', 'b', 'a'], antiguos: ['a', 'b', 'c'],
    nombre_asc: ['a', 'b', 'c'], tamanio_asc: ['c', 'a', 'b'], tamanio_desc: ['b', 'a', 'c'],
  };
  const servicio = crearBibliotecaDemo([...archivos]);
  for (const { valor } of ordenes) {
    const consulta = { ...leerConsulta(new URLSearchParams()), orden: valor };
    const resultado = await servicio.buscar(consulta, new AbortController().signal);
    assert.deepEqual(resultado.items.map(a => a.id), esperados[valor]);
  }
  assert.deepEqual(archivos.map(a => a.id), ['b', 'a', 'c']);
});

test('Strategy: todos los criterios desempatan por ID y mantienen páginas sin duplicados', async () => {
  const empatados = Array.from({ length: 14 }, (_, i) =>
    archivo(String(14 - i).padStart(2, '0'), 'Igual.pdf', '20', '2026-10-01T12:00:00Z'));
  const servicio = crearBibliotecaDemo(empatados);
  for (const { valor } of ordenes) {
    const consulta = { ...leerConsulta(new URLSearchParams()), orden: valor };
    const primera = await servicio.buscar(consulta, new AbortController().signal);
    const segunda = await servicio.buscar({ ...consulta, pagina: 2 }, new AbortController().signal);
    assert.equal(primera.items.length, 12);
    assert.equal(primera.total, 14);
    assert.deepEqual([...primera.items, ...segunda.items].map(a => a.id),
      Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, '0')));
  }
});

test('Strategy: nombre ignora diferencias de acentos y mayúsculas como antes', () => {
  const a = archivo('a', 'ÁRBOL.pdf', '1', '2026-10-01T12:00:00Z');
  const b = archivo('b', 'arbol.pdf', '1', '2026-10-01T12:00:00Z');
  assert.deepEqual([b, a].sort(seleccionarEstrategiaOrden('nombre_asc')).map(a => a.id), ['a', 'b']);
});
