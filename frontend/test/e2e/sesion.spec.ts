import { test, expect, type Page } from '@playwright/test';

const consumo = {
  plan: { id: 1, nombre: 'Free', precio_mensual: 0 },
  almacenamiento: { cuota_bytes: 5000000000, usados_bytes: 0, reservados_bytes: 0, disponibles_bytes: 5000000000, porcentaje_utilizado: 0 },
  descargas: { limite: 2, ilimitadas: false, consumidas: 0, restantes: 2, inicio: '2026-10-01', fin: '2026-11-01' },
  alertas: { almacenamiento: null, descargas: null },
};
test.beforeEach(async ({ context }) => {
  // Contrato HTTP controlado: estos tests verifican el navegador, no sustituyen integración del backend.
  await context.route('**/api/**', async route => {
    const ruta = new URL(route.request().url()).pathname;
    const json = ruta === '/api/auth/login'
      ? { token: 'sesion-de-prueba', usuario: { id: 'prueba', nombre_completo: 'Usuario de prueba', correo_electronico: 'prueba@example.test', rol: 'CLIENTE' } }
      : ruta === '/api/auth/me' ? { usuario: { id: 'prueba', nombre_completo: 'Usuario de prueba', correo_electronico: 'prueba@example.test', rol: 'CLIENTE' } }
      : ruta === '/api/planes/mi-consumo' ? consumo
      : ruta.startsWith('/api/biblioteca/') ? { items: [], total: 0, pagina: 1, por_pagina: 12 }
      : [];
    await route.fulfill({ json });
  });
});

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('ejemplo@correo.com').fill('prueba@example.test');
  await page.locator('input[type=password]').fill('Prueba123!');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.sidebar-user')).toContainText('Usuario de prueba');
}

for (const accion of ['clic', 'Enter', 'Space']) {
  test(`cerrar sesión con ${accion}: limpia persistencia y bloquea Atrás, recarga y acceso directo`, async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Mis Archivos', exact: true }).click();
    await expect(page).toHaveURL(/\/archivos$/);
    await page.evaluate(() => {
      sessionStorage.setItem('token', 'sesion-antigua');
      sessionStorage.setItem('usuario', 'usuario-antiguo');
    });
    const salir = page.getByRole('button', { name: 'Cerrar Sesión', exact: true });
    if (accion === 'clic') await salir.click();
    else { await salir.focus(); await salir.press(accion); }
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => [localStorage.getItem('token'), localStorage.getItem('usuario'), sessionStorage.getItem('token'), sessionStorage.getItem('usuario')])).toEqual([null, null, null, null]);
    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('.sidebar')).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    const peticiones: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/')) peticiones.push(r.url()); });
    for (const ruta of ['/dashboard', '/archivos', '/biblioteca', '/planes', '/planes/contratar', '/planes/historial']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator('.sidebar')).toHaveCount(0);
    }
    expect(peticiones).toEqual([]);
    await entrar(page); // Una nueva autenticación vuelve a permitir el acceso.
  });
}

test('cerrar sesión en otra pestaña desmonta el contenido protegido', async ({ page, context }) => {
  await entrar(page);
  const otra = await context.newPage();
  await otra.goto('/biblioteca');
  await expect(otra.locator('.sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar Sesión', exact: true }).click();
  await expect(otra).toHaveURL(/\/login$/);
  await expect(otra.locator('.sidebar')).toHaveCount(0);
});
