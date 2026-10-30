import { test, expect, type Page } from '@playwright/test';
async function preparar(page: Page) {
  const usuario = { id: 'admin-config', nombre_completo: 'Ana López', correo_electronico: 'ana@example.test', rol: 'CLIENTE' };
  const archivos = ['Especificaciones_Proyecto_Final.pdf','Captura_Pantalla_Dashboard_V2.png','Assets_Iconos_Vaultly.zip','index.config.ts','Base_Datos_Clientes_2025.csv'].map((nombre, i) => ({id:String(i+1),nombre_original:nombre,tamanio_bytes:3400000,tipo_mime:'application/octet-stream',es_publica:i%2===1,carpeta_id:null,created_at:'2026-10-15T12:00:00Z',etiquetas:[]}));
  const recursos = ['Guia_Estilos_UI_Kit.fig','Manual_Despliegue_AWS.pdf','auth_middleware_v2.ts','Assets_Ilustraciones_3D.zip','Contrato_Servicios_Plantilla.docx','Presentacion_Inversores_2026.pdf','landing_page_responsive.html','Pack_Iconos_Productividad.svg'].map((nombre,i)=>({...archivos[i%5],id:String(i+20),nombre_original:nombre,tamanio_bytes:'3400000',descargas:428+i*30,autor:{id:String(i),nombre_completo:['Fernando Pérez','Ana Martínez','Carlos Gómez','Elena Ríos'][i%4]},etiquetas:[{id:1,nombre:'Diseño'},{id:2,nombre:'Recursos'}]}));
  let solicitud: null | { id: string; correo: string; estado: string; vence_en: string; reenviar_desde: string; intentos_restantes: number } = null;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const d = method === 'POST' || method === 'PUT' || method === 'PATCH' ? route.request().postDataJSON() : {};
    if (path === '/api/auth/login') return route.fulfill({ json: { token: 'prueba', usuario } });
    if (path === '/api/auth/me') return route.fulfill({ json: { usuario } });
    if (path === '/api/planes/mi-consumo') return route.fulfill({json:{plan:{id:1,nombre:'Free',precio_mensual:0},almacenamiento:{cuota_bytes:5000000000,usados_bytes:0,reservados_bytes:0,disponibles_bytes:5000000000,porcentaje_utilizado:0},descargas:{limite:2,ilimitadas:false,consumidas:0,restantes:2,inicio:'2026-10-01',fin:'2026-11-01'},alertas:{almacenamiento:null,descargas:null}}});
    if (path === '/api/archivos') return route.fulfill({json:archivos});
    if (path.startsWith('/api/biblioteca')) return route.fulfill({json:{items:path.endsWith('/archivos') ? recursos : [],total:recursos.length,pagina:1,por_pagina:12}});
    if (path === '/api/planes') return route.fulfill({json:[{id:1,nombre:'Free',precio_mensual:0,cuota_storage_gb:5,limite_descargas:2}]});
    if (path === '/api/planes/pagos') return route.fulfill({json:[{id:'pago',fecha:'2026-10-01',codigo:'TEST-001',plan:'Free',monto:0,metodo:'tarjeta',estado:'Completado'}]});
    if (path === '/api/admin/planes') return route.fulfill({ json: [{ id: 1, nombre: 'Equipo', precio_mensual: 50, cuota_storage_gb: 20, limite_descargas: null, activo: true, permite_carpetas_publicas: false }] });
    if (path === '/api/cuenta/perfil' && method === 'PATCH') { usuario.nombre_completo = d.nombre_completo; return route.fulfill({ json: { usuario } }); }
    if (path === '/api/admin/administradores') return route.fulfill({ json: [{ ...usuario, estado_cuenta: 'ACTIVO', created_at: '2026-01-01' }] });
    if (path === '/api/auth/recuperar') return route.fulfill({ json: { mensaje: `Enlace enviado a ${d.email}` } });
    if (path === '/api/cuenta/cambio-correo/confirmar') {
      if (d.codigo !== '123456') { if (solicitud) solicitud.intentos_restantes--; return route.fulfill({ status: 400, json: { error: 'El código no es correcto', codigo: 'CODIGO_INVALIDO' } }); }
      usuario.correo_electronico = solicitud!.correo; solicitud = null;
      return route.fulfill({ json: { usuario, notificado: true, mensaje: 'Correo actualizado y aviso enviado a tu dirección anterior.' } });
    }
    if (path === '/api/cuenta/cambio-correo') {
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
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/configuracion');
  await expect(page.getByRole('heading', { name: 'Seguridad', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nuevo correo', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar correo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar código', exact: true })).toBeVisible();
}

test('verifica correo, conserva pendiente al recargar y actualiza perfil y recuperación', async ({ page }) => {
  await preparar(page);
  await page.getByLabel('Nuevo correo', { exact: true }).fill('nuevo@example.test');
  await page.getByLabel('Contraseña actual', { exact: true }).fill('Actual123!');
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
  await expect(page.getByRole('button', { name: /Reenviar en/ })).toBeDisabled();
  await expect(page.locator('.cuenta-perfil-datos')).toContainText('ana@example.test');
  await page.reload();
  await page.getByLabel('Código de verificación').fill('999999');
  await page.getByRole('button', { name: 'Confirmar nuevo correo' }).click();
  await expect(page.locator('.aviso-error')).toContainText('El código no es correcto');
  await expect(page.getByLabel('Código de verificación')).toHaveValue('999999');
  await page.getByLabel('Código de verificación').fill('123456');
  await page.getByRole('button', { name: 'Confirmar nuevo correo' }).click();
  await expect(page.locator('.cuenta-perfil-datos')).toContainText('nuevo@example.test');
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
  await expect(page.locator('.cuenta-perfil-datos')).toContainText('ana@example.test');
  await page.route('**/api/cuenta/cambio-correo', async route => {
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
  await expect(page.locator('.cuenta-perfil-resumen')).toContainText('Ana María López');
  await expect(page.locator('.sidebar-user')).toContainText('Ana María López');
  await page.reload();
  await expect(page.locator('.cuenta-perfil-resumen')).toContainText('Ana María López');
});

for (const width of [1366, 390]) test(`cliente: tema, navegación y formularios a ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({width,height:960});
  await page.emulateMedia({colorScheme:'dark'});
  await preparar(page);
  await expect(page.locator('.cliente-app')).toHaveAttribute('data-tema','oscuro');
  await expect(page.getByLabel('Nuevo correo',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Contraseña actual',{exact:true})).toHaveValue('');
  await page.getByLabel('Nuevo correo',{exact:true}).fill('correo@gmail.co');
  await page.getByLabel('Contraseña actual',{exact:true}).fill('Actual123!');
  await page.getByRole('button',{name:'Enviar código',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('gmail.com');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.screenshot({path:info.outputPath('cliente-oscuro.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('radio',{name:'Modo claro'}).check();
  await page.evaluate(()=>localStorage.setItem('vaultly:admin:tema','oscuro'));
  await page.reload();
  await expect(page.locator('.cliente-app')).toHaveAttribute('data-tema','claro');
  expect(await page.evaluate(()=>localStorage.getItem('vaultly:admin:tema'))).toBe('oscuro');
  await page.screenshot({path:info.outputPath('cliente-claro.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('radio',{name:'Modo oscuro'}).check();
  for (const name of ['Dashboard','Mis Archivos','Biblioteca Pública','Planes y Facturación','Configuración']) {
    if(width<650) await page.getByRole('button',{name:'☰ Menú'}).click();
    await page.getByRole('link',{name,exact:true}).filter({visible:true}).click();
    await expect(page.locator('.cliente-app')).toHaveAttribute('data-tema','oscuro');
    if(name==='Biblioteca Pública') await expect(page.locator('.biblioteca-tarjeta')).toHaveCount(8);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`pantalla-${name.replaceAll(' ','-')}.png`),fullPage:true,animations:'disabled'});
    if(width>650) {
      await page.evaluate(()=>{localStorage.setItem('vaultly:cliente:tema','claro');window.dispatchEvent(new Event('storage'));});
      await expect(page.locator('.cliente-app')).toHaveAttribute('data-tema','claro');
      await page.screenshot({path:info.outputPath(`claro-${name.replaceAll(' ','-')}.png`),fullPage:true,animations:'disabled'});
      await page.evaluate(()=>{localStorage.setItem('vaultly:cliente:tema','oscuro');window.dispatchEvent(new Event('storage'));});
    }
    if(name==='Dashboard') {
      await page.getByRole('button',{name:'Cargar archivo',exact:true}).click();
      await expect(page.locator('.carga-modal')).toBeVisible();
      await page.screenshot({path:info.outputPath('cliente-carga-oscuro.png'),fullPage:true,animations:'disabled'});
      await page.keyboard.press('Escape');
      // The upload dialog has an explicit close control; navigation below does not require uploads.
      await page.goto('/configuracion');
    }
  }
  await page.goto('/planes/historial');
  await page.getByRole('button',{name:'Descargar comprobante TEST-001'}).click();
  await expect(page.getByRole('dialog')).toContainText('ana@example.test');
  await expect(page.locator('.cp-overlay')).toHaveAttribute('data-tema','oscuro');
  await page.screenshot({path:info.outputPath('comprobante-oscuro.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.goto('/admin/configuracion');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.admin-sidebar')).toHaveCount(0);
  await page.goto('/login');
  await expect(page.locator('.cliente-app')).toHaveCount(0);
});

test('configuración exige sesión', async ({page})=>{
  await page.goto('/configuracion');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading',{name:'Editar perfil'})).toHaveCount(0);
});
