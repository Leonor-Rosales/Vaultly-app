import { test, expect, type Page } from '@playwright/test';

async function sesion(page: Page, rol: 'ADMIN' | 'CLIENTE') {
  const usuario = { id:'actor', nombre_completo:'Ana López', correo_electronico:'ana@example.test', rol };
  await page.addInitScript(usuario => { localStorage.setItem('token','prueba'); localStorage.setItem('usuario',JSON.stringify(usuario)); localStorage.setItem(`vaultly:${usuario.rol==='ADMIN'?'admin':'cliente'}:tema`,'claro'); },usuario);
  await page.route('**/api/**',route=>{
    const p=new URL(route.request().url()).pathname;
    if(p==='/api/auth/me') return route.fulfill({json:{usuario}});
    if(p==='/api/planes/mi-consumo') return route.fulfill({json:{plan:{id:1,nombre:'Free'},almacenamiento:{usados_bytes:0,cuota_bytes:5000000000},descargas:{fin:'2030-12-01'},alertas:{almacenamiento:null,descargas:null}}});
    return route.fulfill({json:[]});
  });
}

for(const [tipo,final] of [['PORCENTAJE',150],['FIJO',49],['GRATIS',0]] as const) test(`admin configura ${tipo} y ve el precio final`,async({page},info)=>{
  await sesion(page,'ADMIN');
  let enviado: Record<string,unknown>|undefined;
  await page.route('**/api/admin/planes**',route=>{
    if(route.request().method()==='GET') return route.fulfill({json:enviado?[enviado]:[]});
    enviado={...route.request().postDataJSON(),id:2,version:1};return route.fulfill({json:enviado});
  });
  await page.goto('/admin/planes/nuevo');
  await page.getByLabel('Nombre del plan').fill('Max'); await page.getByLabel('Precio mensual').fill('200');
  await page.getByLabel('Almacenamiento (GB)').fill('100'); await page.getByLabel('Descargas ilimitadas',{exact:true}).check();
  await page.getByRole('checkbox',{name:'Promoción temporal'}).check();
  const nombres = { FIJO: 'Precio fijo', PORCENTAJE: 'Porcentaje de descuento', GRATIS: 'Período gratis' };
  if(tipo === 'PORCENTAJE') {
    await page.getByRole('radio',{name:'Precio fijo',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio',{name:nombres[tipo],exact:true})).toBeChecked();
  } else await page.getByRole('radio',{name:nombres[tipo],exact:true}).check();
  await expect(page.getByRole('radio',{checked:true})).toHaveCount(1);
  if(tipo==='PORCENTAJE') await page.getByLabel('Descuento (%)').fill('25');
  if(tipo==='FIJO') await page.getByLabel('Precio promocional (Q)').fill('49');
  if(tipo==='GRATIS') await expect(page.getByLabel('Precio promocional (Q)')).toHaveCount(0);
  await expect(page.locator('.admin-promocion-previa')).toContainText(`Q${final.toFixed(2)}`);
  await page.getByLabel('Inicio de promoción (Guatemala)').fill('2030-11-01T00:00');
  await page.getByLabel('Fin de promoción (Guatemala)').fill('2030-11-20T00:00');
  if(tipo==='PORCENTAJE') {
    await page.screenshot({path:info.outputPath('promocion-porcentaje.png'),fullPage:true});
    await page.setViewportSize({width:390,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('promocion-tarjetas-movil.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Crear plan',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/planes$/);
  expect(enviado).toMatchObject({promocion_tipo:tipo,promocion_porcentaje:tipo==='PORCENTAJE'?25:null,promocion_precio:final,precio_mensual:200});
});

for(const width of [1366,390]) test(`cliente ve porcentaje y comprobante con descuento a ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await sesion(page,'CLIENTE');
  await page.route('**/api/planes',route=>route.fulfill({json:[{id:2,version:1,nombre:'Max',precio_mensual:'200.00',precio_vigente:150,promocion_vigente:true,promocion_tipo:'PORCENTAJE',promocion_porcentaje:'25.00',promocion_fin:'2030-11-20T06:00:00Z',cuota_storage_gb:100,limite_descargas:null}]}));
  let solicitud: Record<string,unknown>|undefined;
  const pago={id:'pago',codigo:'DESCUENTO-001',fecha:'2026-11-11T18:00:00Z',plan:'Max',monto:150,metodo:'tarjeta',estado:'Completado',comprobante:{version:1,moneda:'GTQ',cliente:{nombre:'Ana López',correo:'ana@example.test'},almacenamientoGb:100,descargasMensuales:null,inicio:'2026-11-11T18:00:00Z',fin:'2026-12-11T18:00:00Z',promocion:{precioHabitual:200,finOferta:'2030-11-20T06:00:00Z',tipo:'PORCENTAJE',porcentaje:25},renovacionAutomatica:false}};
  await page.route('**/api/planes/contratar',route=>{solicitud=route.request().postDataJSON();return route.fulfill({json:pago});});
  await page.route('**/api/planes/pagos',route=>route.fulfill({json:[pago]}));
  await page.goto('/planes/contratar?plan=2');
  await expect(page.locator('.ct-summary')).toContainText('25 % de descuento');
  await expect(page.locator('.ct-total')).toContainText('150.00');
  await page.getByRole('button',{name:'Confirmar Pago',exact:true}).click();
  expect(solicitud).toBeUndefined();
  await page.getByLabel('Número de tarjeta').fill('4242424242424242');await page.getByLabel('Nombre de titular').fill('Ana López');await page.getByLabel('Fecha de vencimiento').fill('1235');await page.getByLabel('CVV',{exact:true}).fill('123');
  await page.getByRole('button',{name:'Confirmar Pago',exact:true}).click();
  await expect(page).toHaveURL(/\/planes\/historial$/);expect(solicitud?.precioConfirmado).toBe(150);
  await page.getByRole('button',{name:'Descargar comprobante DESCUENTO-001'}).click();
  expect(await page.locator('.cp-sheet').evaluate(el=>el.scrollTop)).toBe(0);
  await expect(page.getByRole('dialog')).toContainText('25 % de descuento');
  await expect(page.getByRole('dialog')).toContainText(/GTQ\s*150.00/);
  await page.screenshot({path:info.outputPath('comprobante-porcentaje.png'),fullPage:true});
});
