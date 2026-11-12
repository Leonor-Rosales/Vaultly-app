import { test, expect, type Page } from '@playwright/test';

async function sesion(page: Page, rol: 'ADMIN' | 'CLIENTE') {
  const usuario = { id:'actor', nombre_completo:'Ana López', correo_electronico:'ana@example.test', rol };
  await page.addInitScript(usuario => { localStorage.setItem('token','prueba'); localStorage.setItem('usuario',JSON.stringify(usuario)); localStorage.setItem(`vaultly:${usuario.rol === 'ADMIN' ? 'admin' : 'cliente'}:tema`,'claro'); },usuario);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if(path==='/api/auth/me') return route.fulfill({json:{usuario}});
    if(path==='/api/planes/mi-consumo') return route.fulfill({json:{plan:{id:1,nombre:'Free'},almacenamiento:{usados_bytes:0,cuota_bytes:5000000000},descargas:{fin:'2030-12-01'},alertas:{almacenamiento:null,descargas:null}}});
    return route.fulfill({json:[]});
  });
}

test('administrador programa una promoción a cero conservando el precio normal y zona Guatemala',async({page})=>{
  await sesion(page,'ADMIN');
  let guardado: Record<string,unknown> | undefined;
  await page.route('**/api/admin/planes**',route=>{
    if(route.request().method()==='GET') return route.fulfill({json:guardado?[guardado]:[]});
    guardado={...route.request().postDataJSON(),id:2,version:1}; return route.fulfill({json:guardado});
  });
  await page.goto('/admin/planes/nuevo');
  await page.getByLabel('Nombre del plan').fill('Max Promoción');
  await page.getByLabel('Precio mensual').fill('200');
  await page.getByLabel('Almacenamiento (GB)').fill('100');
  await page.getByLabel('Descargas ilimitadas',{exact:true}).check();
  await page.getByRole('checkbox',{name:'Promoción temporal'}).check();
  await page.getByLabel('Precio promocional (Q)').fill('0');
  await page.getByLabel('Inicio de promoción (Guatemala)').fill('2030-11-01T00:00');
  await page.getByLabel('Fin de promoción (Guatemala)').fill('2030-11-20T00:00');
  await page.getByRole('button',{name:'Crear plan',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/planes$/);
  expect(guardado).toMatchObject({precio_mensual:200,promocion_precio:0,promocion_inicio:'2030-11-01T06:00:00.000Z',promocion_fin:'2030-11-20T06:00:00.000Z'});
  await expect(page.locator('.admin-table-scroll')).toContainText('Promoción: Q0.00');
});

for(const width of [1366,390]) test(`auditoría con detalle, filtros, paginación y tema a ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1050});
  await sesion(page,'ADMIN');
  const evento={id:'1',usuario_id:'actor',administrador:'Ana López',codigo:'PLAN_EDITADO',fecha_hora:'2026-11-11T18:00:00Z',modulo_afectado:'planes',detalles_json:{anterior:{nombre:'Max',precio_mensual:'200.00',promocion_precio:null,activo:true,version:1},nuevo:{nombre:'Max',precio_mensual:'200.00',promocion_precio:'0.00',promocion_inicio:'2030-11-01T06:00:00Z',promocion_fin:'2030-11-20T06:00:00Z',activo:true,version:2}}};
  const filtros: string[]=[];
  await page.route('**/api/admin/auditoria?**',route=>{
    const query=new URL(route.request().url()).searchParams; filtros.push(query.toString());
    const pagina=Number(query.get('pagina')); return route.fulfill({json:{items:[{...evento,id:String(pagina)}],total:26,pagina,por_pagina:25}});
  });
  await page.goto('/admin/auditoria');
  await expect(page.getByRole('heading',{name:'Auditoría',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver cambios',exact:true}).click();
  await expect(page.getByRole('region',{name:'Detalle de cambios'})).toContainText('Precio promocional (Q)');
  await expect(page.getByRole('region',{name:'Detalle de cambios'})).toContainText('0.00');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('auditoria-claro.png'),fullPage:true});
  await page.evaluate(()=>{localStorage.setItem('vaultly:admin:tema','oscuro');window.dispatchEvent(new Event('storage'));});
  await expect(page.locator('.admin-app')).toHaveAttribute('data-tema','oscuro');
  await page.screenshot({path:info.outputPath('auditoria-oscuro.png'),fullPage:true});
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await page.getByLabel('Acción',{exact:true}).selectOption('PLAN_EDITADO');
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByLabel('Administrador o registro').fill('Max');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect.poll(()=>filtros.at(-1)).toContain('q=Max');
  expect(filtros.some(f=>f.includes('accion=PLAN_EDITADO'))).toBe(true);
  await page.getByLabel('Desde',{exact:true}).fill('2026-11-12');
  await page.getByLabel('Hasta',{exact:true}).fill('2026-11-12');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect.poll(()=>filtros.at(-1)).toContain('hasta=2026-11-12');
  expect(new URLSearchParams(filtros.at(-1)).get('desde')).toBe('2026-11-12');
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  expect(new URLSearchParams(filtros.at(-1)).get('hasta')).toBe('2026-11-12');
  const solicitudes=filtros.length;
  await page.getByLabel('Desde',{exact:true}).fill('2026-11-13');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.locator('.admin-main .aviso-advertencia')).toContainText('Desde no puede ser posterior');
  expect(filtros.length).toBe(solicitudes);
  await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  for(const campo of ['Administrador o registro','Desde','Hasta']) await expect(page.getByLabel(campo,{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Acción',{exact:true})).toHaveValue('');
  expect(Object.fromEntries(new URLSearchParams(filtros.at(-1)))).toEqual({pagina:'1',accion:'',q:'',desde:'',hasta:''});
  await expect(page.locator('.admin-main .aviso-advertencia')).toHaveCount(0);
});

for(const width of [1366,390]) test(`promoción gratuita sin tarjeta y renovación opcional a ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1050}); await sesion(page,'CLIENTE');
  await page.route('**/api/planes',route=>route.fulfill({json:[{id:2,version:1,nombre:'Max',precio_mensual:'200.00',precio_vigente:0,promocion_vigente:true,promocion_fin:'2030-11-20T06:00:00Z',cuota_storage_gb:100,limite_descargas:null}]}));
  let solicitud: Record<string,unknown> | undefined;
  const pago={id:'pago',codigo:'PROMO-001',fecha:'2026-11-11T18:00:00Z',plan:'Max',monto:0,metodo:'tarjeta',estado:'Completado',comprobante:{version:1,moneda:'GTQ',cliente:{nombre:'Ana López',correo:'ana@example.test'},almacenamientoGb:100,descargasMensuales:null,inicio:'2026-11-11T18:00:00Z',fin:'2026-12-11T18:00:00Z',promocion:{precioHabitual:200,finOferta:'2030-11-20T06:00:00Z'},renovacionAutomatica:false}};
  await page.route('**/api/planes/contratar',route=>{solicitud=route.request().postDataJSON();return route.fulfill({json:pago});});
  await page.route('**/api/planes/pagos',route=>route.fulfill({json:[pago]}));
  await page.goto('/planes/contratar?plan=2');
  await expect(page.getByLabel('Número de tarjeta')).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:/Renovar automáticamente/})).not.toBeChecked();
  await expect(page.locator('.ct-renovar')).toContainText('Q200.00');
  await page.screenshot({path:info.outputPath('contratacion-gratis.png'),fullPage:true});
  await page.getByRole('button',{name:'Activar plan gratis',exact:true}).click();
  await expect(page).toHaveURL(/\/planes\/historial$/);
  expect(solicitud).toMatchObject({precioConfirmado:0,versionPlan:1,renovar:false});
  expect(Object.keys(solicitud!)).not.toContain('numero');
  await page.getByRole('button',{name:'Descargar comprobante PROMO-001'}).click();
  await expect(page.getByRole('dialog')).toContainText('Activación sin cobro');
  await expect(page.getByRole('dialog')).toContainText('Renovación automática: desactivada');
  await page.screenshot({path:info.outputPath('comprobante-promocion.png'),fullPage:true});
  if(width===1366) await page.pdf({path:info.outputPath('comprobante-promocion.pdf'),format:'A4',printBackground:true});
});
