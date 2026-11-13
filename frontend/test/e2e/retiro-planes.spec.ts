import { test, expect, type Page } from '@playwright/test';

async function sesion(page: Page) {
  const usuario = { id:'actor',nombre_completo:'Ana López',correo_electronico:'ana@example.test',rol:'ADMIN' };
  await page.addInitScript(usuario=>{localStorage.setItem('token','prueba');localStorage.setItem('usuario',JSON.stringify(usuario));localStorage.setItem('vaultly:admin:tema','claro');},usuario);
  await page.route('**/api/**',route=>new URL(route.request().url()).pathname==='/api/auth/me'?route.fulfill({json:{usuario}}):route.fulfill({json:[]}));
}

for(const width of [1366,390]) test(`retiro de planes: aviso, fecha y reactivación a ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1050});await sesion(page);
  let plan={id:2,version:1,nombre:'Max anterior',precio_mensual:200,cuota_storage_gb:100,limite_descargas:null,activo:false,permite_carpetas_publicas:false,inactivo_desde:'2026-11-12T18:00:00Z' as string|null,retiro_desde:'2026-12-12T18:00:00Z' as string|null,tiene_historial:true,suscripciones_vigentes:0};
  let guardados=0;
  await page.route('**/api/admin/planes**',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:[{...plan,id:1,nombre:'Free',precio_mensual:0,activo:true,inactivo_desde:null,retiro_desde:null},plan,{...plan,id:3,nombre:'Plan con clientes',suscripciones_vigentes:2}]});
    guardados++;plan={...plan,...route.request().postDataJSON(),activo:true,version:2,inactivo_desde:null,retiro_desde:null};return route.fulfill({json:plan});
  });
  await page.goto('/admin/planes');
  await expect(page.locator('.admin-main .aviso-informacion')).toContainText('30 días');
  await expect(page.getByRole('row').filter({hasText:'Max anterior'})).toContainText('12/12/2026');
  await expect(page.getByRole('row').filter({hasText:'Plan con clientes'})).toContainText('hasta que terminen');
  await expect(page.getByRole('button',{name:'Desactivar Free',exact:true})).toBeDisabled();
  await page.screenshot({path:info.outputPath('planes-retiro.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.admin-main .aviso-informacion')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Planes y facturación'})).toBeVisible();
  await expect(page.locator('.admin-main .aviso-informacion')).toHaveCount(0);
  await page.getByRole('button',{name:'Activar Max anterior',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Se cancelará su retiro automático');
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Desactivar Max anterior',exact:true})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Max anterior'})).not.toContainText('Retiro a partir');
  expect(guardados).toBe(1);
  await page.getByRole('button',{name:'Desactivar Max anterior',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('30 días');
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(guardados).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('los avisos leídos pertenecen a cada cuenta y reaparecen si cambia su contenido',async({page})=>{
  await sesion(page);
  await page.goto('/admin/planes');
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
  await page.route('**/api/auth/me',route=>route.fulfill({json:{usuario:{id:'otra-cuenta',nombre_completo:'Otro admin',correo_electronico:'otro@example.test',rol:'ADMIN'}}}));
  await page.reload();
  await expect(page.locator('.admin-main .aviso-informacion')).toContainText('30 días');
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
  await page.evaluate(()=>{
    localStorage.setItem('vaultly:aviso-leido:otra-cuenta:retiro-planes','Versión anterior de la información');
  });
  await page.reload();
  await expect(page.locator('.admin-main .aviso-informacion')).toContainText('30 días');
  await page.getByRole('link',{name:'Crear nuevo plan'}).click();
  await page.getByLabel('Promoción temporal',{exact:true}).check();
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
  await expect(page.locator('.admin-promocion .aviso-informacion')).toHaveCount(0);
  // La explicación esencial y la vista previa permanecen disponibles.
  await expect(page.getByText('Escribe el precio mensual habitual para calcular la promoción.')).toBeVisible();
  await page.reload();
  await page.getByLabel('Promoción temporal',{exact:true}).check();
  await expect(page.locator('.admin-promocion .aviso-informacion')).toHaveCount(0);
});

test('el aviso se puede cerrar aunque el navegador bloquee guardar la preferencia',async({page})=>{
  await sesion(page);
  await page.addInitScript(()=>{
    const guardar=Storage.prototype.setItem;
    Storage.prototype.setItem=function(clave,valor){
      if(clave.startsWith('vaultly:aviso-leido:'))throw new DOMException('Bloqueado','SecurityError');
      return guardar.call(this,clave,valor);
    };
  });
  await page.goto('/admin/planes');
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();
  await expect(page.locator('.admin-main .aviso-informacion')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.admin-main .aviso-informacion')).toContainText('30 días');
});

test('auditoría conserva nombre y detalle de un plan eliminado por el sistema',async({page},info)=>{
  await sesion(page);
  const evento={id:'1',usuario_id:null,administrador:'Sistema automático',codigo:'PLAN_ELIMINADO',fecha_hora:'2026-12-12T18:00:00Z',modulo_afectado:'planes',detalles_json:{origen:'LIMPIEZA_AUTOMATICA',plan_id:2,anterior:{id:2,nombre:'Plan nunca usado',precio_mensual:'20.00',activo:false,inactivo_desde:'2026-11-12T18:00:00Z',archivado_en:null},nuevo:null}};
  await page.route('**/api/admin/auditoria?**',route=>route.fulfill({json:{items:[evento],total:1,pagina:1,por_pagina:25}}));
  await page.goto('/admin/auditoria');
  await expect(page.locator('.admin-table-scroll')).toContainText('Sistema automático');
  await expect(page.locator('.admin-table-scroll')).toContainText('Plan nunca usado');
  await page.getByRole('button',{name:'Ver cambios',exact:true}).click();
  await expect(page.getByRole('region',{name:'Detalle de cambios'})).toContainText('sin pagos ni suscripciones');
  await page.getByLabel('Acción',{exact:true}).selectOption('PLAN_ELIMINADO');
  await expect(page.locator('.admin-table-scroll')).toContainText('Plan eliminado sin uso');
  await page.screenshot({path:info.outputPath('auditoria-retiro.png'),fullPage:true});
});

for(const width of [1366,390]) test(`plan contratado protege las condiciones y explica el correo de retiro a ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1050}); await sesion(page);
  let plan={id:2,version:1,nombre:'Max',precio_mensual:200,cuota_storage_gb:100,limite_descargas:100,activo:true,permite_carpetas_publicas:true,tiene_suscripciones:true,suscripciones_vigentes:2};
  let guardados=0;
  await page.route('**/api/admin/planes**',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:[plan]});
    guardados++;plan={...plan,...route.request().postDataJSON(),version:2};return route.fulfill({json:plan});
  });
  await page.goto('/admin/planes/2/editar');
  await expect(page.getByText('Este plan ya tiene contrataciones.',{exact:false})).toBeVisible();
  for(const nombre of ['Nombre del plan','Precio mensual (USD)','Almacenamiento (GB)','Límite de descargas','Descargas ilimitadas','Permitir carpetas públicas']) await expect(page.getByLabel(nombre,{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Promoción temporal',{exact:true})).toBeEnabled();
  await expect(page.getByLabel('Estado activo',{exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('plan-protegido.png'),fullPage:true});
  await page.getByLabel('Estado activo',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('se programará un correo, tengan o no renovación automática');
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  expect(guardados).toBe(0);
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/planes$/);
  expect(guardados).toBe(1);expect(plan.activo).toBe(false);
});
