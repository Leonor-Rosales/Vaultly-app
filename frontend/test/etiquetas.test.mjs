import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as reglas from '../../shared/etiquetas.mjs';

test('texto pendiente se incluye, normaliza y valida al enviar', () => {
  assert.deepEqual(reglas.incluirPendiente(['año'], ' AÑO '), ['año']);
  assert.deepEqual(reglas.incluirPendiente([], ' bases   de datos '), ['bases de datos']);
  assert.deepEqual(reglas.incluirPendiente(['a'], ''), ['a']);
  assert.throws(() => reglas.incluirPendiente([], ' '));
  assert.throws(() => reglas.incluirPendiente(['a','b','c','d','e'], 'f'));
  assert.throws(() => reglas.incluirPendiente([], '😀'.repeat(31)));
});

// Ejecuta los handlers reales del control sin navegador; useId es el único hook.
const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/Etiquetas.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports = {};
new Function('require', 'exports', code)(name => name === 'react' ? {useId: () => 'test-id'} : name.endsWith('.css') ? {} : name.endsWith('etiquetas.mjs') ? reglas : require(name), exports);
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
test('Enter impide enviar formulario, agrega, deduplica y permite quitar con botón accesible', () => {
  let etiquetas = ['año'], pendiente = ' AÑO ', error = '', prevented = false;
  const render = () => nodes(exports.default({etiquetas, pendiente, error,
    onChange: v => etiquetas = v, onPendiente: v => pendiente = v, onError: v => error = v}));
  render().find(n => n.type === 'input').props.onKeyDown({key:'Enter', nativeEvent:{}, preventDefault: () => prevented = true});
  assert.ok(prevented); assert.deepEqual(etiquetas, ['año']); assert.equal(pendiente, '');
  const button = render().find(n => n.type === 'button');
  assert.equal(button.props['aria-label'], 'Quitar etiqueta año');
  button.props.onClick(); assert.deepEqual(etiquetas, []);
  pendiente = 'a'.repeat(31);
  render().find(n => n.type === 'input').props.onKeyDown({key:'Enter', nativeEvent:{}, preventDefault(){}});
  assert.match(error, /30/); assert.deepEqual(etiquetas, []);
});
