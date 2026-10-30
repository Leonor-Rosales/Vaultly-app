import { test, expect, type Page } from '@playwright/test';

async function preparar(page: Page, rol = 'ADMIN') {
  const usuario = { id: '00000000-0000-4000-8000-000000000001', nombre_completo: 'Ana López', correo_electronico: 'ana@example.test', rol };
  let planes = [{ id: 1, nombre: 'Free', precio_mensual: 0, cuota_storage_gb: 5, limite_descargas: 2 as number | null, activo: true, permite_carpetas_publicas: false }];
  let usuarios = [{ ...usuario, estado_cuenta: 'ACTIVO', created_at: '2026-01-01' }];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const body = method === 'POST' || method === 'PUT' ? route.request().postDataJSON() : null;
    if (path === '/api/auth/login') return route.fulfill({ json: { token: 'prueba-admin', usuario } });
    if (path === '/api/auth/me') return route.fulfill({ json: { usuario } });
    if (path === '/api/planes/mi-consumo') return route.fulfill({ json: {
      plan: { id: 1, nombre: 'Free', precio_mensual: 0 },
      almacenamiento: { cuota_bytes: 100000000, usados_bytes: 0, reservados_bytes: 0, disponibles_bytes: 100000000, porcentaje_utilizado: 0 },
      descargas: { limite: 2, ilimitadas: false, consumidas: 0, restantes: 2, inicio: '2026-10-01', fin: '2026-11-01' },
      alertas: { almacenamiento: null, descargas: null },
    } });
    if (path === '/api/auth/recuperar') return route.fulfill({ json: { mensaje: 'Enlace solicitado' } });
    if (path.startsWith('/api/admin/planes')) {
      if (method === 'GET') return route.fulfill({ json: planes });
      const id = method === 'POST' ? 2 : Number(path.split('/').pop());
      const plan = { ...body, id };
      planes = [...planes.filter(p => p.id !== id), plan];
      return route.fulfill({ json: plan });
    }
    if (path.startsWith('/api/admin/administradores')) {
      if (method === 'GET') return route.fulfill({ json: usuarios });
      const id = method === 'POST' ? '00000000-0000-4000-8000-000000000002' : path.split('/').pop()!;
      const admin = { ...body, id, estado_cuenta: body.activo ? 'ACTIVO' : 'BLOQUEADO', created_at: '2026-01-01' };
      usuarios = [...usuarios.filter(u => u.id !== id), admin];
      return route.fulfill({ json: admin });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/login');
  await page.getByPlaceholder('ejemplo@correo.com').fill('ana@example.test');
  await page.locator('input[type=password]').fill('Segura123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(rol === 'ADMIN' ? /\/admin\/planes$/ : /\/dashboard$/);
}

for (const ancho of [1366, 390]) {
  test(`administración: planes, cuentas, configuración y logout a ${ancho}px`, async ({ page }, info) => {
    await page.setViewportSize({ width: ancho, height: 960 });
    await preparar(page);
    await expect(page.getByRole('heading', { name: 'Planes y facturación' })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`planes-${ancho}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Crear nuevo plan' }).click();
    await page.getByLabel('Nombre del plan').fill('Equipo');
    await page.getByLabel('Precio mensual').fill('59.95');
    await page.getByLabel('Almacenamiento (GB)').fill('30');
    await page.getByLabel('Descargas ilimitadas', { exact: true }).check();
    await page.getByLabel('Permitir carpetas públicas').check();
    await page.screenshot({ path: info.outputPath(`formulario-${ancho}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Equipo' })).toContainText('Ilimitadas');
    await page.reload();
    await page.getByRole('link', { name: 'Editar Equipo' }).click();
    await page.getByLabel('Precio mensual').fill('65');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Equipo' })).toContainText('Q65.00');
    await page.getByRole('button', { name: 'Desactivar Equipo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Equipo' })).toContainText('Inactivo');
    if (ancho < 760) await page.getByRole('button', { name: 'Menú de administrador' }).click();
    await page.getByRole('link', { name: 'Administradores', exact: true }).click();
    await page.getByRole('button', { name: 'Crear administrador', exact: true }).click();
    await page.getByLabel('Nombre completo').fill('Luis Pérez');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('luis@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Segura123!');
    await page.getByLabel('Confirmar contraseña').fill('Segura123!');
    await page.getByRole('button', { name: 'Guardar administrador' }).click();
    await page.getByLabel('Buscar administradores').fill('luis');
    await expect(page.getByRole('row').filter({ hasText: 'Luis Pérez' })).toBeVisible();
    await page.getByRole('button', { name: 'Editar Luis Pérez' }).click();
    await page.getByLabel('Nombre completo').fill('Luis Actualizado');
    await page.getByRole('button', { name: 'Guardar administrador' }).click();
    await page.getByRole('button', { name: 'Desactivar Luis Actualizado' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Luis Actualizado' })).toContainText('Inactivo');
    if (ancho < 760) await page.getByRole('button', { name: 'Menú de administrador' }).click();
    await page.getByRole('link', { name: 'Configuración' }).click();
    await expect(page.getByText('ana@example.test', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Solicitar cambio de contraseña' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enlace solicitado' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (ancho < 760) await page.getByRole('button', { name: 'Menú de administrador' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/admin/planes');
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
}
test('cliente no accede al panel por URL', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', error => errores.push(error.message));
  await preparar(page, 'CLIENTE');
  await page.goto('/admin/administradores');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.admin-sidebar')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});
test('listado vacío y error recuperable no simulan éxito', async ({ page }) => {
  await preparar(page);
  await page.route('**/api/admin/planes', route => route.fulfill({ status: 500, json: { error: 'Fallo de prueba' } }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Fallo de prueba');
  await page.route('**/api/admin/planes', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('No hay planes.', { exact: false })).toBeVisible();
});
