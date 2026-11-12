import { test, expect, type Page } from '@playwright/test';

async function sesion(page: Page, rol: 'ADMIN' | 'CLIENTE') {
  const usuario = { id: 'usuario', rol, nombre_completo: 'Ana López', correo_electronico: 'ana@example.test' };
  await page.addInitScript(usuario => { localStorage.setItem('token', 'prueba'); localStorage.setItem('usuario', JSON.stringify(usuario)); localStorage.setItem(`vaultly:${usuario.rol === 'ADMIN' ? 'admin' : 'cliente'}:tema`, 'claro'); }, usuario);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { usuario } });
    if (path === '/api/planes/mi-consumo') return route.fulfill({ json: { plan: { id: 1, nombre: 'Free' }, almacenamiento: { usados_bytes: 0, cuota_bytes: 5000000000 }, descargas: { fin: '2026-12-01' }, alertas: { almacenamiento: null, descargas: null } } });
    return route.fulfill({ json: [] });
  });
}
const base = { id: 2, version: 1, nombre: 'Pro', precio_mensual: 49, cuota_storage_gb: 50, limite_descargas: null, activo: true, permite_carpetas_publicas: false };

test('admin conserva el formulario ante conflicto y exige recargar antes de guardar', async ({ page }, info) => {
  await sesion(page, 'ADMIN');
  let plan = { ...base };
  const enviados: number[] = [];
  await page.route('**/api/admin/planes**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [plan] });
    const d = route.request().postDataJSON(); enviados.push(d.version);
    if (d.version !== plan.version) return route.fulfill({ status: 409, json: { codigo: 'PLAN_DESACTUALIZADO', error: 'Otro administrador modificó este plan. Recarga el plan antes de guardar; tus cambios no se aplicaron.' } });
    plan = { ...d, id: 2, version: plan.version + 1 };
    return route.fulfill({ json: plan });
  });
  await page.goto('/admin/planes/2/editar');
  await page.getByLabel('Precio mensual').fill('59');
  plan = { ...plan, version: 2, precio_mensual: 79 };
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('.admin-main .aviso-advertencia')).toContainText('Otro administrador');
  await expect(page.getByLabel('Precio mensual')).toHaveValue('59');
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('admin-conflicto.png'), fullPage: true });
  await page.getByRole('button', { name: 'Recargar plan' }).click();
  await expect(page.getByLabel('Precio mensual')).toHaveValue('79');
  await page.getByLabel('Precio mensual').fill('80');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/admin\/planes$/);
  expect(enviados).toEqual([1, 2]); expect(plan.precio_mensual).toBe(80);
});

test('activar o desactivar desde una lista antigua muestra el aviso reutilizado', async ({ page }) => {
  await sesion(page, 'ADMIN');
  await page.route('**/api/admin/planes**', route => route.request().method() === 'GET'
    ? route.fulfill({ json: [base] })
    : route.fulfill({ status: 409, json: { codigo: 'PLAN_DESACTUALIZADO', error: 'Otro administrador modificó este plan. Recarga el plan antes de guardar.' } }));
  await page.goto('/admin/planes');
  await page.getByRole('button', { name: 'Desactivar Pro' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('.admin-main .aviso-advertencia')).toContainText('Otro administrador');
  await page.getByRole('button', { name: 'Actualizar planes' }).click();
  await expect(page.locator('.admin-table-scroll')).toContainText('Activo');
});

for (const width of [1366, 390]) test(`cliente revisa las condiciones actualizadas antes de volver a confirmar a ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await sesion(page, 'CLIENTE');
  let plan = { ...base };
  const versiones: number[] = [];
  let fallaResumen = false;
  await page.route('**/api/planes', route => fallaResumen ? route.fulfill({ status: 503, json: { error: 'Fallo temporal' } }) : route.fulfill({ json: [plan] }));
  await page.route('**/api/planes/contratar', route => {
    const d = route.request().postDataJSON(); versiones.push(d.versionPlan);
    if (d.versionPlan === 1) {
      plan = { ...plan, version: 2, precio_mensual: 99, cuota_storage_gb: 70 };
      return route.fulfill({ status: 409, json: { codigo: 'PLAN_DESACTUALIZADO', error: 'El plan cambió.' } });
    }
    return route.fulfill({ json: { id: 'pago', fecha: '2026-11-11', codigo: 'PRUEBA', plan: 'Pro', monto: 99, metodo: 'tarjeta', estado: 'Completado' } });
  });
  await page.goto('/planes/contratar?plan=2');
  await page.getByLabel('Número de tarjeta').fill('4242424242424242');
  await page.getByLabel('Nombre de titular').fill('Ana López');
  await page.getByLabel('Fecha de vencimiento').fill('1235');
  await page.getByLabel('CVV', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Confirmar Pago', exact: true }).click();
  await expect(page.locator('.aviso-advertencia')).toContainText('No se realizó ningún cobro');
  await expect(page.getByRole('button', { name: 'Confirmar Pago', exact: true })).toBeDisabled();
  expect(versiones).toEqual([1]);
  fallaResumen = true;
  await page.getByRole('button', { name: 'Actualizar resumen del plan' }).click();
  await expect(page.locator('.aviso-advertencia')).toContainText('No se pudo actualizar');
  await expect(page.getByRole('button', { name: 'Confirmar Pago', exact: true })).toBeDisabled();
  fallaResumen = false;
  await page.getByRole('button', { name: 'Actualizar resumen del plan' }).click();
  await expect(page.locator('.ct-total')).toContainText('99.00');
  await expect(page.locator('.ct-summary')).toContainText('70 GB');
  await expect(page.locator('.aviso-advertencia')).toContainText('Resumen actualizado');
  expect(versiones).toEqual([1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('cliente-plan-actualizado.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar Pago', exact: true }).click();
  await expect(page).toHaveURL(/\/planes\/historial$/);
  expect(versiones).toEqual([1, 2]);
});

test('el formulario de creación exige precio positivo para un plan nuevo', async ({ page }) => {
  await sesion(page, 'ADMIN');
  await page.goto('/admin/planes/nuevo');
  await page.getByLabel('Nombre del plan').fill('Otro gratuito');
  await page.getByLabel('Precio mensual').fill('0');
  expect(await page.getByLabel('Precio mensual').evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
  await expect(page.getByText('Solo el plan Free puede tener precio cero.')).toBeVisible();
});
