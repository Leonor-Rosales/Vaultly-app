// Ejecutar dentro del contenedor Linux. Solo utiliza documentos sintéticos,
// almacenamiento en disco temporal y loopback: no conecta PostgreSQL ni R2.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { crearConversorOffice } = require('../src/infrastructure/conversorOffice');
const { crearServidorVistasPrevias } = require('../src/workers/servidorVistasPrevias');
const ejecutar = promisify(execFile);

async function main() {
  const fixtures = path.resolve(process.argv[2]);
  const secreto = 'secreto-sintetico-solo-ensayo-office-http';
  let formato;
  let llamadas = 0;
  const resultados = [];
  const convertir = crearConversorOffice({
    descargarTemporal: (objeto, destino) => fs.copyFile(path.join(fixtures, objeto), destino),
  });
  const servidor = crearServidorVistasPrevias({ secreto, procesarSiguiente: async () => {
    llamadas++;
    const inicio = performance.now();
    await convertir({ nombre_objeto_minio: `prueba.${formato}` }, formato, async ({ pdf, miniatura }) => {
      const contenido = await fs.readFile(pdf);
      assert.equal(contenido.subarray(0, 5).toString(), '%PDF-');
      const imagen = await fs.readFile(miniatura);
      assert.equal(imagen.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const { stdout } = await ejecutar('pdftotext', [pdf, '-'], { timeout: 15000 });
      assert.match(stdout, new RegExp(`Vaultly ${formato.toUpperCase()} prueba`));
      resultados.push({ formato, pdfBytes: contenido.length, miniaturaBytes: imagen.length,
        ancho: imagen.readUInt32BE(16), alto: imagen.readUInt32BE(20) });
    });
    resultados.at(-1).duracionMs = Math.round(performance.now() - inicio);
  } });
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${servidor.address().port}/internal/procesar-vista-previa`;
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal(llamadas, 0);
    for (formato of ['docx', 'xlsx']) {
      const respuesta = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secreto}` } });
      assert.equal(respuesta.status, 200, await respuesta.text());
    }
    assert.equal(llamadas, 2);
    const temporales = (await fs.readdir('/tmp')).filter(nombre => nombre.startsWith('vaultly-previa-'));
    assert.deepEqual(temporales, [], 'No deben quedar directorios temporales del conversor');
    console.log(JSON.stringify({ resultado: 'OK', resultados, maxRssKiB: process.resourceUsage().maxRSS,
      alcance: 'Conversión HTTP local; no valida Neon, R2, recursos de LibreOffice ni Vercel' }, null, 2));
  } finally {
    await new Promise(resolve => servidor.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
