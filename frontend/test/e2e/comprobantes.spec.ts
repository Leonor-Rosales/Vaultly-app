import { test, expect } from '@playwright/test';

for (const width of [1366, 390]) test(`comprobante histórico, teclado e impresión a ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1050 });
  const usuario = { id: 'cliente', nombre_completo: 'Perfil modificado', correo_electronico: 'nuevo@example.test', rol: 'CLIENTE' };
  const pago = { id: 'pago', fecha: '2026-11-11T18:00:00Z', codigo: 'VLT-TEST-001', plan: 'Pro Developer', monto: 49, metodo: 'tarjeta', estado: 'Completado', comprobante: {
    version: 1, moneda: 'GTQ', cliente: { nombre: 'Ana López', correo: 'original@example.test' }, almacenamientoGb: 50, descargasMensuales: null,
    inicio: '2026-11-11T18:00:00Z', fin: '2026-12-11T18:00:00Z',
  } };
  await page.addInitScript(usuario => { localStorage.setItem('token', 'prueba'); localStorage.setItem('usuario', JSON.stringify(usuario)); localStorage.setItem('vaultly:cliente:tema', 'claro'); }, usuario);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { usuario } });
    if (path === '/api/planes/pagos') return route.fulfill({ json: [pago, { ...pago, id: 'viejo', codigo: 'VLT-ANTIGUO', comprobante: null }] });
    if (path === '/api/planes/mi-consumo') return route.fulfill({ json: { plan: { id: 2, nombre: 'Plan nuevo' }, almacenamiento: { usados_bytes: 0, cuota_bytes: 1000000000 }, descargas: { fin: '2026-12-11', ilimitadas: true }, alertas: { almacenamiento: null, descargas: null } } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/planes/historial');
  const abrir = page.getByRole('button', { name: 'Descargar comprobante VLT-TEST-001', exact: true });
  await abrir.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('original@example.test');
  await expect(dialog).not.toContainText('nuevo@example.test');
  await expect(dialog).toContainText('50 GB');
  await expect(dialog).toContainText('Ilimitadas');
  await expect(dialog).toContainText('11 dic 2026');
  await expect(dialog).toContainText(/GTQ\s*49.00/);
  const cerrar = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(cerrar).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Descargar PDF' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cerrar).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Captura la ficha completa sin alterar su diseño de impresión.
  await page.screenshot({ path: info.outputPath('comprobante-claro.png'), fullPage: true });
  await page.evaluate(() => { localStorage.setItem('vaultly:cliente:tema', 'oscuro'); window.dispatchEvent(new Event('storage')); });
  await expect(page.locator('.cp-overlay')).toHaveAttribute('data-tema', 'oscuro');
  await page.screenshot({ path: info.outputPath('comprobante-oscuro.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(dialog.getByRole('button', { name: 'Descargar PDF' })).not.toBeVisible();
  await expect(dialog).toContainText('original@example.test');
  await page.screenshot({ path: info.outputPath('comprobante-impresion.png'), fullPage: true });
  if (width === 1366) await page.pdf({ path: info.outputPath('comprobante.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(abrir).toBeFocused();
  await page.getByRole('button', { name: 'Descargar comprobante VLT-ANTIGUO', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('no se guardaron');
  await expect(page.getByRole('dialog')).not.toContainText('nuevo@example.test');
});
