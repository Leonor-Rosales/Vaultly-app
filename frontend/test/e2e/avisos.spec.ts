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
