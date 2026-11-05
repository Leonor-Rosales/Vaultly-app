const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

function ejecutar(comando, argumentos, tiempo) {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, argumentos, { detached: true, stdio: 'ignore' });
    const reloj = setTimeout(() => {
      try { process.kill(-proceso.pid, 'SIGKILL'); } catch {}
    }, tiempo);
    proceso.once('error', error => { clearTimeout(reloj); reject(error); });
    proceso.once('close', codigo => {
      clearTimeout(reloj);
      if (codigo === 0) resolve();
      else reject(new Error('El conversor falló o superó el tiempo permitido'));
    });
  });
}

function crearConversorOffice(almacenamiento) {
  return async (archivo, formato, guardar) => {
    const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'vaultly-previa-'));
    try {
      const entrada = path.join(temporal, 'original.' + formato);
      const perfil = path.join(temporal, 'perfil');
      await fs.mkdir(path.join(perfil, 'user'), { recursive: true });
      await fs.writeFile(path.join(perfil, 'user', 'registrymodifications.xcu'), `<?xml version="1.0"?>
        <oor:items xmlns:oor="http://openoffice.org/2001/registry">
          <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
            <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
          </item>
        </oor:items>`);
      await almacenamiento.descargarTemporal(archivo.nombre_objeto_minio, entrada);
      await ejecutar('libreoffice', [
        '-env:UserInstallation=' + pathToFileURL(perfil).href,
        '--headless', '--nologo', '--nodefault', '--nofirststartwizard',
        '--convert-to', 'pdf', '--outdir', temporal, entrada,
      ], 90000);
      const pdf = path.join(temporal, 'original.pdf');
      await fs.access(pdf);
      const prefijo = path.join(temporal, 'miniatura');
      await ejecutar('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '640', '-png', pdf, prefijo], 20000);
      await guardar({ pdf, miniatura: prefijo + '.png' });
    } finally {
      await fs.rm(temporal, { recursive: true, force: true });
    }
  };
}
module.exports = { crearConversorOffice };
