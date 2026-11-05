import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

function archivo(id = 'propio', nombre = 'informe.pdf', bytes = 20000000) {
  return { id, nombre_original: nombre, tamanio_bytes: bytes, tipo_mime: 'application/pdf', es_publica: false,
    carpeta_id: null, created_at: '2026-10-01T12:00:00Z', etiquetas: [] };
}
async function preparar(page: Page, usados = 20000000) {
  const estado = { usados, cuota: 100000000, reservados: 0, restantes: 2, ilimitadas: false, falloConsumo: false,
    falloCarga: '', archivoFallido: '', errorDescarga: '', cargas: [] as string[], eliminaciones: 0, archivos: [archivo()] };
  await page.addInitScript(() => {
    localStorage.setItem('token', 'sesion-prueba');
    localStorage.setItem('usuario', JSON.stringify({ id: 'yo', nombre_completo: 'Fernando Pérez', rol: 'CLIENTE' }));
  });
  await page.route('**/api/**', async route => {
    const ruta = new URL(route.request().url()).pathname;
    if (ruta === '/api/auth/me') return route.fulfill({json:{usuario:{id:'yo',nombre_completo:'Fernando Pérez',correo_electronico:'fernando@example.test',rol:'CLIENTE'}}});
    if (ruta === '/api/planes/mi-consumo') {
      if (estado.falloConsumo) return route.fulfill({ status: 503, json: { error: 'Servicio temporalmente no disponible' } });
      return route.fulfill({ json: {
        plan: { id: 1, nombre: 'Free', precio_mensual: 0 },
        almacenamiento: { cuota_bytes: estado.cuota, usados_bytes: estado.usados, reservados_bytes: estado.reservados,
          disponibles_bytes: Math.max(0, estado.cuota - estado.usados - estado.reservados), porcentaje_utilizado: 0 },
        descargas: { limite: estado.ilimitadas ? null : 2, ilimitadas: estado.ilimitadas, consumidas: 2 - estado.restantes,
          restantes: estado.ilimitadas ? null : estado.restantes, inicio: '2026-10-01', fin: '2026-11-01' },
        alertas: { almacenamiento: estado.usados + estado.reservados >= estado.cuota ? 'LIMITE' : (estado.usados + estado.reservados) / estado.cuota >= .8 ? 'PROXIMIDAD' : null,
          descargas: estado.ilimitadas ? null : estado.restantes === 0 ? 'LIMITE' : null },
      } });
    }
    if (ruta === '/api/archivos' && route.request().method() === 'POST') {
      const nombre = /filename="([^"]+)"/.exec(route.request().postData() ?? '')?.[1] ?? 'archivo';
      estado.cargas.push(nombre);
      if (estado.falloCarga && (!estado.archivoFallido || estado.archivoFallido === nombre)) {
        if (estado.falloCarga === 'red') return route.abort('failed');
        return route.fulfill({ status: 409, json: { error: estado.falloCarga === 'CUOTA_ALMACENAMIENTO' ? 'No tienes espacio suficiente para subir este archivo.' : 'No se pudo guardar el archivo.', codigo: estado.falloCarga } });
      }
      const nuevo = archivo(`nuevo-${estado.cargas.length}`, nombre);
      estado.archivos.push(nuevo); estado.usados += nuevo.tamanio_bytes;
      return route.fulfill({ status: 201, json: nuevo });
    }
    if (ruta === '/api/archivos') return route.fulfill({ json: estado.archivos });
    if (route.request().method() === 'DELETE') {
      estado.eliminaciones++;
      const id = ruta.split('/').pop();
      const borrado = estado.archivos.find(a => a.id === id);
      estado.usados -= borrado?.tamanio_bytes ?? 0;
      estado.archivos = estado.archivos.filter(a => a.id !== id);
      return route.fulfill({ json: { mensaje: 'Archivo eliminado' } });
    }
    if (ruta.endsWith('/descargar')) {
      if (estado.errorDescarga) return route.fulfill({ status: 409, json: { error: 'No quedan descargas disponibles.', codigo: estado.errorDescarga } });
      return route.fulfill({ body: 'contenido', contentType: 'application/pdf' });
    }
    if (ruta === '/api/biblioteca/archivos') return route.fulfill({ json: { items: [
      { ...archivo('publico', 'Guía de estilos.pdf'), tamanio_bytes: '20000000', descargas: 12, autor: { id: 'otro', nombre_completo: 'Ana Martínez' } },
    ], total: 1, pagina: 1, por_pagina: 12 } });
    if (ruta.startsWith('/api/biblioteca/')) return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: [] });
  });
  return estado;
}
async function seleccionar(page: Page, nombres = ['nuevo.pdf']) {
  await page.getByRole('button', { name: 'Cargar archivo', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(nombres.map(name => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('prueba') })));
  await page.getByRole('button', { name: 'Cargar archivos', exact: true }).click();
}

test('la barra crece tras subir y disminuye tras eliminar; cancelar no borra', async ({ page }) => {
  const estado = await preparar(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  await seleccionar(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  await expect.poll(async () => page.locator('.uso-relleno').evaluate(el => el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width)).toBeCloseTo(.4, 1);
  await page.getByRole('link', { name: 'Mis Archivos', exact: true }).click();
  await page.getByTitle('Eliminar archivo', { exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '¿Eliminar archivo?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(estado.eliminaciones).toBe(0);
  await page.getByTitle('Eliminar archivo', { exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar archivo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  expect(estado.eliminaciones).toBe(1);
});

test('archivos pequeños tienen marca visible sin inventar el porcentaje; cero queda vacío', async ({ page }) => {
  const estado = await preparar(page, 4000);
  estado.cuota = 5000000000;
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '< 0.1% utilizados');
  await expect.poll(async () => page.locator('.uso-relleno').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(4);
  estado.usados = 0;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => page.locator('.uso-relleno').evaluate(el => el.getBoundingClientRect().width)).toBe(0);
});

test('almacenamiento lleno abre aviso accesible y enlaza a planes', async ({ page }, info) => {
  await page.emulateMedia({colorScheme:'light'});
  await preparar(page, 100000000);
  await page.goto('/archivos');
  await expect(page.getByRole('heading', { name: 'Almacenamiento lleno' })).toBeVisible();
  await page.getByRole('button', { name: 'Cargar archivo', exact: true }).click();
  const aviso = page.getByRole('dialog', { name: 'Almacenamiento lleno' });
  await expect(aviso).toBeVisible();
  await expect(aviso.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.screenshot({ path: info.outputPath('almacenamiento-lleno.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(aviso).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cargar archivo', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Cargar archivo', exact: true }).click();
  await aviso.getByRole('button', { name: 'Ver planes' }).click();
  await expect(page).toHaveURL(/\/planes$/);
});

test('rechazo de cuota conserva el archivo pendiente y permite reintentarlo', async ({ page }) => {
  const estado = await preparar(page, 80000000);
  estado.falloCarga = 'CUOTA_ALMACENAMIENTO';
  await page.goto('/archivos');
  await seleccionar(page);
  const aviso = page.getByRole('dialog', { name: 'Espacio insuficiente' });
  await expect(aviso).toContainText('nuevo.pdf');
  await aviso.getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(page.locator('.carga-error-archivo')).toContainText('No tienes espacio');
  estado.falloCarga = '';
  await page.getByRole('button', { name: 'Cargar archivos', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Almacenamiento lleno' })).toBeVisible();
  expect(estado.cargas).toEqual(['nuevo.pdf', 'nuevo.pdf']);
});

test('carga parcial muestra un resumen y reintenta solo el fallido', async ({ page }) => {
  const estado = await preparar(page);
  estado.falloCarga = 'ERROR'; estado.archivoFallido = 'fallido.pdf';
  await page.goto('/archivos');
  await seleccionar(page, ['correcto.pdf', 'fallido.pdf']);
  const aviso = page.getByRole('dialog', { name: 'No se pudo subir el archivo' });
  await expect(aviso).toContainText('1 archivo(s) guardados');
  await expect(aviso).toContainText('fallido.pdf');
  await aviso.getByRole('button', { name: 'Entendido' }).click();
  estado.falloCarga = '';
  await page.getByRole('button', { name: 'Cargar archivos', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(estado.cargas).toEqual(['correcto.pdf', 'fallido.pdf', 'fallido.pdf']);
});

test('fallo de red muestra una ventana explicativa y no marca éxito', async ({ page }, info) => {
  const estado = await preparar(page); estado.falloCarga = 'red';
  await page.goto('/archivos');
  await seleccionar(page);
  await expect(page.getByRole('dialog', { name: 'No se pudo subir el archivo' })).toContainText('Comprueba tu conexión');
  await expect(page.locator('.aviso-exito')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('error-carga-movil.png'), fullPage: true });
  const rect = await page.locator('.aviso-dialogo').boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
});

test('descargas agotadas: banner persistente, error modal y plan ilimitado sin alerta', async ({ page }, info) => {
  await page.emulateMedia({colorScheme:'light'});
  const estado = await preparar(page); estado.restantes = 0; estado.errorDescarga = 'CUOTA_DESCARGAS';
  await page.goto('/biblioteca');
  await expect(page.getByRole('heading', { name: 'Límite de descargas agotado' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar Guía de estilos.pdf' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('limite-descargas.png'), fullPage: true });
  await page.getByRole('button', { name: 'Descargar Guía de estilos.pdf' }).click();
  await expect(page.getByRole('dialog', { name: 'Límite de descargas agotado' })).toBeVisible();
  await page.keyboard.press('Escape');
  estado.ilimitadas = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Límite de descargas agotado' })).toHaveCount(0);
});

test('un fallo al consultar consumo conserva la barra y permite reintentar', async ({ page }) => {
  const estado = await preparar(page, 80000000);
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  estado.falloConsumo = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'No pudimos actualizar tu consumo' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  estado.falloConsumo = false; estado.usados = 90000000;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
  await expect(page.getByRole('heading', { name: 'No pudimos actualizar tu consumo' })).toHaveCount(0);
});

test('las reservas se distinguen del espacio usado y no bloquean las descargas propias', async ({ page }) => {
  const estado = await preparar(page, 80000000); estado.reservados = 20000000; estado.restantes = 0;
  await page.goto('/archivos');
  await expect(page.getByRole('heading', { name: 'Espacio reservado por cargas en curso' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  const descarga = page.waitForEvent('download');
  await page.getByTitle('Descargar archivo', { exact: true }).click();
  expect((await descarga).suggestedFilename()).toBe('informe.pdf');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('administrar archivos desde un rechazo de carga permite volver a la lista', async ({ page }) => {
  const estado = await preparar(page, 80000000); estado.falloCarga = 'CUOTA_ALMACENAMIENTO';
  await page.goto('/archivos');
  await seleccionar(page);
  await page.getByRole('dialog', { name: 'Espacio insuficiente' }).getByRole('button', { name: 'Administrar archivos' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTitle('Eliminar archivo', { exact: true })).toBeVisible();
});

test('las miniaturas abren imágenes y páginas PDF y omiten formatos sin vista previa', async ({ page }) => {
  const estado = await preparar(page);
  estado.archivos.push({ ...archivo('imagen', 'portada.svg'), tipo_mime: 'image/svg+xml' },
    { ...archivo('zip', 'datos.zip'), tipo_mime: 'application/zip' });
  await page.setContent('<p>Portada</p><p style="break-before:page">Segunda página</p>');
  const pdf = await page.pdf();
  await page.route('**/api/archivos/propio/vista-previa', route => route.fulfill({ contentType: 'application/pdf', body: pdf }));
  await page.route('**/api/archivos/imagen/vista-previa', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="25" fill="green"/></svg>',
  }));
  await page.goto('/archivos');
  await page.getByRole('button', { name: 'Ver vista previa de informe.pdf' }).click();
  const visor = page.getByRole('dialog');
  await expect(visor.locator('canvas')).toBeVisible();
  await visor.getByRole('button', { name: 'Siguiente' }).click();
  await expect(visor.getByText('2 de 2')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ver vista previa de portada.svg' }).click();
  await expect(visor.getByRole('img', { name: 'portada.svg' })).toBeVisible();
  await visor.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Ver vista previa de datos.zip' })).toHaveCount(0);
});

test('miniaturas de texto y tablas presentan HTML literal y celdas CSV y TSV', async ({ page }) => {
  const estado = await preparar(page);
  const muestras = [
    { nombre: 'pagina.html', contenido: '<script>throw "no ejecutar"</script>', mime: 'text/html' },
    { nombre: 'ventas.csv', contenido: 'Artículo,Importe\r\n"Pan, integral",5\r\n"Dos\nlíneas",8', mime: 'application/vnd.ms-excel' },
    { nombre: 'lista.tsv', contenido: 'ID\tNombre\n1\tAna', mime: 'application/octet-stream' },
  ];
  estado.archivos = muestras.map(m => ({ ...archivo(m.nombre, m.nombre, m.contenido.length), tipo_mime: m.mime }));
  for (const m of muestras) {
    await page.route(`**/api/archivos/${m.nombre}/vista-previa`, r => r.fulfill({ contentType: 'text/plain', body: m.contenido }));
  }
  await page.goto('/archivos');
  for (const m of muestras) {
    await page.getByRole('button', { name: 'Ver vista previa de ' + m.nombre }).click();
    const visor = page.getByRole('dialog');
    if (m.nombre.endsWith('.html')) await expect(visor.locator('pre')).toHaveText(m.contenido);
    else await expect(visor.getByRole('cell', { name: m.nombre.endsWith('.csv') ? 'Pan, integral' : 'Ana' })).toBeVisible();
    await visor.getByRole('button', { name: 'Cerrar' }).click();
  }
});

test('miniaturas multimedia muestran duración y fotograma y abren el reproductor', async ({ page }) => {
  const estado = await preparar(page);
  const video = readFileSync(new URL('./fixtures/colores.webm', import.meta.url));
  const wav = Buffer.alloc(44 + 8000, 128);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(8000, 40);
  for (const [id, mime, body] of [['voz.wav', 'audio/wav', wav], ['clip.webm', 'video/webm', Buffer.from(video)]] as const) {
    estado.archivos.push({ ...archivo(id, id, body.length), tipo_mime: mime });
    await page.route(`**/api/archivos/${id}/vista-previa`, r => r.fulfill({ contentType: mime, body }));
  }
  await page.goto('/archivos');
  await expect(page.getByText('0:01', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.miniatura-medio video').evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  for (const [nombre, tipo] of [['voz.wav', 'audio'], ['clip.webm', 'video']]) {
    const miniatura = page.getByRole('button', { name: 'Ver vista previa de ' + nombre });
    await miniatura.scrollIntoViewIfNeeded();
    await miniatura.click();
    const visor = page.getByRole('dialog');
    await expect(visor.locator(tipo + '[controls]')).toBeVisible();
    await expect.poll(() => visor.locator(tipo).evaluate((el: HTMLMediaElement) => el.currentTime)).toBeGreaterThan(0);
    await visor.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.locator('dialog ' + tipo)).toHaveCount(0);
  }
});

test('miniaturas Office esperan la conversión, cargan la imagen y abren el PDF al pulsar', async ({ page }) => {
  const estado = await preparar(page);
  await page.setContent('<h1>Documento convertido</h1>');
  const pdf = await page.pdf();
  const png = await page.screenshot();
  estado.archivos = ['informe.docx', 'ventas.xlsx'].map(nombre => ({
    ...archivo(nombre, nombre, 200),
    tipo_mime: nombre.endsWith('docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  let consultas = 0;
  let cargasPdf = 0;
  await page.route('**/api/archivos/*/estado-vista-previa', r =>
    r.fulfill({ json: { estado: ++consultas <= 2 ? 'PROCESANDO' : 'LISTA' } }));
  await page.route('**/api/archivos/*/miniatura', r => r.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('**/api/archivos/*/vista-previa', r => {
    cargasPdf++;
    return r.fulfill({ body: pdf, contentType: 'application/pdf' });
  });
  await page.goto('/archivos');
  await expect(page.getByText('Preparando vista previa…').first()).toBeVisible();
  const abrir = page.getByRole('button', { name: 'Ver vista previa de informe.docx' });
  await expect(abrir).toBeEnabled({ timeout: 10000 });
  expect(cargasPdf).toBe(0);
  await abrir.click();
  const visor = page.getByRole('dialog');
  await expect(visor.locator('canvas')).toBeVisible();
  expect(cargasPdf).toBeGreaterThan(0);
  await visor.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Ver vista previa de ventas.xlsx' }).click();
  await expect(visor.locator('canvas')).toBeVisible();
});

test('la conversión fallida permite reintentar y sigue mostrando descarga del original', async ({ page }) => {
  const estado = await preparar(page);
  estado.archivos = [{ ...archivo('fallido', 'documento.docx'), tipo_mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }];
  let reintentado = false;
  await page.route('**/api/archivos/*/estado-vista-previa', r => r.fulfill({ json: { estado: reintentado ? 'PENDIENTE' : 'FALLIDA' } }));
  await page.route('**/api/archivos/*/reintentar-vista-previa', r => {
    reintentado = true; return r.fulfill({ json: { estado: 'PENDIENTE' } });
  });
  await page.goto('/archivos');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('Preparando vista previa…')).toBeVisible();
  await expect(page.getByTitle('Descargar archivo', { exact: true })).toBeEnabled();
});

test('Biblioteca abre los mismos visores gratuitamente y mantiene íconos sin vista previa', async ({ page }) => {
  const estado = await preparar(page);
  estado.restantes = 0;
  await page.setContent('<h1>Documento público</h1>');
  const pdf = await page.pdf();
  const png = await page.screenshot();
  const muestras = [
    ['Guía.pdf', 'application/pdf'],
    ['Notas.txt', 'text/plain'],
    ['Datos.csv', 'text/csv'],
    ['Portada.png', 'image/png'],
    ['Documento.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['Libro.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['Archivo.zip', 'application/zip'],
  ];
  let descargas = 0;
  await page.route('**/api/biblioteca/archivos?*', r => r.fulfill({ json: {
    items: muestras.map(([nombre, mime], i) => ({ ...archivo(String(i), nombre, 100), tipo_mime: mime, tamanio_bytes: '100',
      descargas: 7, autor: { id: 'otro', nombre_completo: 'Ana Martínez' } })),
    total: muestras.length, pagina: 1, por_pagina: 12,
  } }));
  await page.route('**/api/archivos/*/descargar', r => { descargas++; return r.fulfill({ body: 'descarga' }); });
  await page.route('**/api/archivos/*/estado-vista-previa', r => r.fulfill({ json: { estado: 'LISTA' } }));
  await page.route('**/api/archivos/*/miniatura', r => r.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('**/api/archivos/*/vista-previa', r => {
    const id = new URL(r.request().url()).pathname.split('/')[3];
    if (id === '1') return r.fulfill({ body: 'Notas de Biblioteca', contentType: 'text/plain' });
    if (id === '2') return r.fulfill({ body: 'Nombre,Total\nAna,5', contentType: 'text/plain' });
    return r.fulfill({ body: id === '3' ? png : pdf, contentType: id === '3' ? 'image/png' : 'application/pdf' });
  });
  await page.goto('/biblioteca');
  for (const [nombre] of muestras.slice(0, 6)) {
    const miniatura = page.getByRole('button', { name: 'Ver vista previa de ' + nombre });
    await miniatura.scrollIntoViewIfNeeded();
    await miniatura.click();
    const visor = page.getByRole('dialog', { name: nombre });
    await expect(visor).toBeVisible();
    if (/pdf|docx|xlsx$/.test(nombre)) await expect(visor.locator('canvas')).toBeVisible();
    if (nombre.endsWith('.csv')) await expect(visor.getByRole('cell', { name: 'Ana', exact: true })).toBeVisible();
    await visor.getByRole('button', { name: 'Cerrar' }).click();
  }
  expect(descargas).toBe(0);
  await expect(page.getByRole('button', { name: 'Ver vista previa de Archivo.zip' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar Archivo.zip', exact: true })).toBeVisible();
});

test('filtros de etiquetas, autor y tipo permiten cambios repetidos y combinados', async ({ page }) => {
  test.setTimeout(60000);
  await preparar(page);
  const errores: string[] = [];
  page.on('pageerror', error => errores.push(error.message));
  page.on('crash', () => errores.push('El navegador se cerró'));
  const consultas: URLSearchParams[] = [];
  await page.route('**/api/biblioteca/etiquetas?*', r => r.fulfill({ json: { items: [{ id: 1, nombre: 'Finanzas' }, { id: 2, nombre: 'Apuntes' }] } }));
  await page.route('**/api/biblioteca/autores?*', r => r.fulfill({ json: { items: [{ id: 'autor-1', nombre_completo: 'Ana Martínez' }, { id: 'autor-2', nombre_completo: 'Luis Pérez' }] } }));
  await page.route('**/api/biblioteca/archivos?*', r => {
    const consulta = new URL(r.request().url()).searchParams;
    consultas.push(consulta);
    return r.fulfill({ json: { items: [], total: 0, pagina: Number(consulta.get('pagina')), por_pagina: 12 } });
  });
  await page.goto('/biblioteca');
  for (let i = 0; i < 3; i++) {
    const etiquetas = page.locator('details').filter({ has: page.getByPlaceholder('Buscar etiquetas…') });
    await etiquetas.locator('summary').click();
    await etiquetas.getByRole('checkbox', { name: 'Finanzas' }).click();
    await expect(etiquetas.getByRole('checkbox', { name: 'Finanzas' })).toBeChecked();
    await expect(page).toHaveURL(/etiqueta_id=1/);
    await etiquetas.getByRole('checkbox', { name: 'Apuntes' }).click();
    await expect(etiquetas.getByRole('checkbox', { name: 'Apuntes' })).toBeChecked();
    await expect(page).toHaveURL(/etiqueta_id=2/);
    await page.getByRole('heading', { name: 'Biblioteca Pública' }).click();
    const autores = page.locator('details').filter({ has: page.getByPlaceholder('Buscar por nombre…') });
    await autores.locator('summary').click();
    await autores.getByRole('radio', { name: 'Ana Martínez' }).click();
    await expect(autores.getByRole('radio', { name: 'Ana Martínez' })).toBeChecked();
    await expect(page).toHaveURL(/autor_id=autor-1/);
    await page.locator('.biblioteca-filtros select').selectOption('documentos');
    await expect.poll(() => consultas.at(-1)?.get('tipo')).toBe('documentos');
    expect(consultas.at(-1)?.getAll('etiqueta_id')).toEqual(['1', '2']);
    expect(consultas.at(-1)?.get('autor_id')).toBe('autor-1');
    await page.getByRole('button', { name: 'Limpiar todo', exact: true }).click();
    for (const tipo of ['imagenes', 'videos', 'audio', 'comprimidos', 'otros', '']) {
      await page.locator('.biblioteca-filtros select').selectOption(tipo);
      await expect.poll(() => consultas.at(-1)?.get('tipo') || '').toBe(tipo);
    }
  }
  expect(errores).toEqual([]);
});

test('filtrar conserva las miniaturas de los archivos que siguen en los resultados', async ({ page }) => {
  test.setTimeout(60000);
  await preparar(page);
  await page.setContent('<h1>Documento de biblioteca</h1>');
  const pdf = await page.pdf();
  let cargas = 0, consultas = 0;
  const items = Array.from({ length: 4 }, (_, i) => ({
    ...archivo('pdf-' + i, 'Documento ' + i + '.pdf', pdf.length), tamanio_bytes: String(pdf.length),
    descargas: 0, autor: { id: 'autor-1', nombre_completo: 'Ana Martínez' }, etiquetas: [{ id: 1, nombre: 'Finanzas' }],
  }));
  await page.route('**/api/biblioteca/etiquetas?*', r => r.fulfill({ json: { items: [{ id: 1, nombre: 'Finanzas' }] } }));
  await page.route('**/api/biblioteca/autores?*', r => r.fulfill({ json: { items: [{ id: 'autor-1', nombre_completo: 'Ana Martínez' }] } }));
  await page.route('**/api/biblioteca/archivos?*', async r => {
    consultas++;
    await new Promise(resolve => setTimeout(resolve, 100));
    return r.fulfill({ json: { items, total: items.length, pagina: 1, por_pagina: 12 } });
  });
  await page.route('**/api/archivos/*/vista-previa', r => {
    cargas++;
    return r.fulfill({ body: pdf, contentType: 'application/pdf' });
  });
  await page.goto('/biblioteca');
  for (let i = 0; i < 4; i++) {
    const vista = page.getByRole('button', { name: 'Ver vista previa de Documento ' + i + '.pdf' });
    await vista.scrollIntoViewIfNeeded();
    await expect(vista).toBeEnabled();
  }
  await page.getByRole('heading', { name: 'Biblioteca Pública' }).scrollIntoViewIfNeeded();
  const inicial = cargas;
  for (let i = 0; i < 3; i++) {
    let anteriores = consultas;
    await page.locator('details').filter({ has: page.getByPlaceholder('Buscar etiquetas…') }).locator('summary').click();
    await page.getByRole('checkbox', { name: 'Finanzas' }).click();
    await expect.poll(() => consultas).toBeGreaterThan(anteriores);
    await expect(page.locator('section[aria-label="Archivos públicos"]')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('heading', { name: 'Biblioteca Pública' }).click();
    anteriores = consultas;
    await page.locator('details').filter({ has: page.getByPlaceholder('Buscar por nombre…') }).locator('summary').click();
    await page.getByRole('radio', { name: 'Ana Martínez' }).click();
    await expect.poll(() => consultas).toBeGreaterThan(anteriores);
    await expect(page.locator('section[aria-label="Archivos públicos"]')).toHaveAttribute('aria-busy', 'false');
    anteriores = consultas;
    await page.locator('.biblioteca-filtros select').selectOption('documentos');
    await expect.poll(() => consultas).toBeGreaterThan(anteriores);
    await expect(page.locator('section[aria-label="Archivos públicos"]')).toHaveAttribute('aria-busy', 'false');
    anteriores = consultas;
    await page.getByRole('button', { name: 'Limpiar todo', exact: true }).click();
    await expect.poll(() => consultas).toBeGreaterThan(anteriores);
    await expect(page.locator('section[aria-label="Archivos públicos"]')).toHaveAttribute('aria-busy', 'false');
  }
  expect(cargas).toBe(inicial);
});
