import { test, expect, type Page } from '@playwright/test';

async function verificarContraste(page: Page) {
  const ratios = await page.locator('.admin-app').evaluate(el => {
    const style = getComputedStyle(el);
    const luminancia = (variable: string) => {
      const valor = style.getPropertyValue(variable).trim().slice(1);
      const hex = valor.length === 3 ? [...valor].map(c => c + c).join('') : valor;
      const componentes = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return componentes[0] * .2126 + componentes[1] * .7152 + componentes[2] * .0722;
    };
    return [['text','bg'], ['muted','surface'], ['on-accent','accent'], ['error','error-bg'], ['success','success-bg'], ['warning','warning-bg'], ['info','info-bg']].map(([a, b]) => {
      const x = luminancia(`--admin-${a}`), y = luminancia(`--admin-${b}`);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
}

async function preparar(page: Page) {
  const usuario = { id: 'admin-config', nombre_completo: 'Ana López', correo_electronico: 'ana@example.test', rol: 'ADMIN' };
  let solicitud: null | { id: string; correo: string; estado: string; vence_en: string; reenviar_desde: string; intentos_restantes: number } = null;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const d = method === 'POST' || method === 'PUT' ? route.request().postDataJSON() : {};
    if (path === '/api/auth/login') return route.fulfill({ json: { token: 'prueba', usuario } });
    if (path === '/api/auth/me') return route.fulfill({ json: { usuario } });
    if (path === '/api/admin/planes') return route.fulfill({ json: [{ id: 1, nombre: 'Equipo', precio_mensual: 50, cuota_storage_gb: 20, limite_descargas: null, activo: true, permite_carpetas_publicas: false }] });
    if (path === '/api/admin/administradores/admin-config' && method === 'PUT') { usuario.nombre_completo = d.nombre_completo; return route.fulfill({ json: usuario }); }
    if (path === '/api/admin/administradores') return route.fulfill({ json: [{ ...usuario, estado_cuenta: 'ACTIVO', created_at: '2026-01-01' }] });
    if (path === '/api/auth/recuperar') return route.fulfill({ json: { mensaje: `Enlace enviado a ${d.email}` } });
    if (path === '/api/admin/cambio-correo/confirmar') {
      if (d.codigo !== '123456') { if (solicitud) solicitud.intentos_restantes--; return route.fulfill({ status: 400, json: { error: 'El código no es correcto', codigo: 'CODIGO_INVALIDO' } }); }
      usuario.correo_electronico = solicitud!.correo; solicitud = null;
      return route.fulfill({ json: { usuario, notificado: true, mensaje: 'Correo actualizado y aviso enviado a tu dirección anterior.' } });
    }
    if (path === '/api/admin/cambio-correo') {
      if (method === 'GET') return route.fulfill({ json: { solicitud } });
      if (method === 'DELETE') { solicitud = null; return route.fulfill({ json: { mensaje: 'Solicitud cancelada. Tu correo actual no cambió.' } }); }
      if (d.password !== 'Actual123!') return route.fulfill({ status: 400, json: { error: 'La contraseña actual no es correcta', codigo: 'PASSWORD_INVALIDA' } });
      solicitud = { id: 'solicitud', correo: d.correo, estado: 'PENDIENTE', vence_en: new Date(Date.now() + 600000).toISOString(), reenviar_desde: new Date(Date.now() + 60000).toISOString(), intentos_restantes: 5 };
      return route.fulfill({ json: { solicitud, mensaje: 'Enviamos el código al nuevo correo.' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/login');
  await page.getByPlaceholder('ejemplo@correo.com').fill('ana@example.test');
  await page.locator('input[type=password]').fill('Actual123!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/planes$/);
  await page.goto('/admin/configuracion');
  await expect(page.getByRole('heading', { name: 'Seguridad', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nuevo correo', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar correo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar código', exact: true })).toBeVisible();
}

for (const ancho of [1366, 390]) {
  test(`tema, navegación, modal y avisos consistentes a ${ancho}px`, async ({ page }, info) => {
    await page.setViewportSize({ width: ancho, height: 960 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await preparar(page);
    await expect(page.locator('.admin-app')).toHaveAttribute('data-tema', 'oscuro');
    await verificarContraste(page);
    await page.screenshot({ path: info.outputPath(`config-oscuro-${ancho}.png`), fullPage: true });
    await page.getByRole('radio', { name: 'Modo claro' }).check();
    await page.reload();
    await expect(page.locator('.admin-app')).toHaveAttribute('data-tema', 'claro');
    await verificarContraste(page);
    await page.screenshot({ path: info.outputPath(`config-claro-${ancho}.png`), fullPage: true });
    await page.getByRole('radio', { name: 'Modo oscuro' }).check();
    if (ancho < 760) await page.getByRole('button', { name: 'Menú de administrador' }).click();
    await page.getByRole('link', { name: 'Planes y facturación' }).click();
    await expect(page.locator('.admin-app')).toHaveAttribute('data-tema', 'oscuro');
    await page.getByRole('button', { name: 'Desactivar Equipo' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.aviso-advertencia')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.screenshot({ path: info.outputPath(`modal-oscuro-${ancho}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.goto('/admin/configuracion');
    await page.getByRole('button', { name: 'Editar correo', exact: true }).click();
    await page.getByLabel('Nuevo correo', { exact: true }).fill('nuevo@example.test');
    await page.getByLabel('Contraseña actual', { exact: true }).fill('mala');
    await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
    await expect(page.locator('.aviso-error')).toHaveCount(1);
    await expect(page.getByLabel('Nuevo correo', { exact: true })).toHaveValue('nuevo@example.test');
    await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Contraseña actual', { exact: true }).fill('Actual123!');
    await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
    await expect(page.locator('.aviso-exito')).toHaveCount(1);
    await expect(page.locator('.aviso-informacion')).toHaveCount(1);
    expect(await page.locator('.aviso-exito').evaluate(el => getComputedStyle(el).borderRadius)).toBe(await page.locator('.aviso-informacion').evaluate(el => getComputedStyle(el).borderRadius));
    await page.screenshot({ path: info.outputPath(`avisos-oscuro-${ancho}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/login');
    await expect(page.locator('.admin-app')).toHaveCount(0);
    expect(await page.locator('.login-page').evaluate(el => getComputedStyle(el).getPropertyValue('--admin-bg'))).toBe('');
  });
}
test('verifica correo, conserva pendiente al recargar y actualiza perfil y recuperación', async ({ page }) => {
  await preparar(page);
  await page.getByLabel('Nuevo correo', { exact: true }).fill('nuevo@example.test');
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Actual123!');
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
  await expect(page.getByRole('button', { name: /Reenviar en/ })).toBeDisabled();
  await expect(page.locator('.admin-perfil-datos')).toContainText('ana@example.test');
  await page.reload();
  await page.getByLabel('Código de verificación').fill('999999');
  await page.getByRole('button', { name: 'Confirmar nuevo correo' }).click();
  await expect(page.locator('.aviso-error')).toContainText('El código no es correcto');
  await expect(page.getByLabel('Código de verificación')).toHaveValue('999999');
  await page.getByLabel('Código de verificación').fill('123456');
  await page.getByRole('button', { name: 'Confirmar nuevo correo' }).click();
  await expect(page.locator('.admin-perfil-datos')).toContainText('nuevo@example.test');
  await expect(page.getByLabel('Código de verificación')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('usuario')!).correo_electronico)).toBe('nuevo@example.test');
  await page.getByRole('button', { name: 'Solicitar cambio de contraseña' }).click();
  await expect(page.locator('.aviso-exito').filter({ hasText: 'Enlace enviado a nuevo@example.test' })).toBeVisible();
});
test('cancelar descarta la solicitud y el fallo SMTP conserva formulario y correo', async ({ page }) => {
  await preparar(page);
  await page.getByLabel('Nuevo correo', { exact: true }).fill('nuevo@example.test');
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Actual123!');
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar solicitud' }).click();
  await expect(page.getByLabel('Código de verificación')).toHaveCount(0);
  await expect(page.locator('.admin-perfil-datos')).toContainText('ana@example.test');
  await page.route('**/api/admin/cambio-correo', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 503, json: { error: 'No pudimos enviar el código. Tu correo actual no cambió.', codigo: 'ENVIO_FALLIDO' } });
    return route.fallback();
  });
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Actual123!');
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
  await expect(page.locator('.aviso-error')).toContainText('No pudimos enviar');
  await expect(page.getByLabel('Nuevo correo', { exact: true })).toHaveValue('nuevo@example.test');
  await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveValue('Actual123!');
});

test('edita el nombre y lo conserva al recargar', async ({ page }) => {
  await preparar(page);
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  await page.getByLabel('Nombre completo', { exact: true }).fill('Ana María López');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.locator('.admin-perfil-resumen')).toContainText('Ana María López');
  await expect(page.locator('.admin-identidad')).toContainText('Ana María López');
  await page.reload();
  await expect(page.locator('.admin-perfil-resumen')).toContainText('Ana María López');
});
