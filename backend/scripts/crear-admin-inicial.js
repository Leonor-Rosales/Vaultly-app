require('dotenv').config();
const { randomBytes } = require('node:crypto');
const { emailValido, normalizarCorreo } = require('../src/domain/validaciones');
const { validarPassword } = require('../src/domain/passwordPolicy');

// Herramienta de consola para una instalación nueva. No es un endpoint público.
async function crearAdminInicial({ pool, hashear, correo, nombre = 'Administración Vaultly' }) {
  correo = normalizarCorreo(correo);
  if (!emailValido(correo) || correo.length > 150) throw new Error('Indica un correo válido como argumento');
  const password = randomBytes(24).toString('base64url') + 'Aa1!';
  validarPassword(password);
  const hash = await hashear(password);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const existentes = await db.query("SELECT 1 FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE r.nombre='ADMIN' LIMIT 1");
    if (existentes.rowCount) throw new Error('Ya existe un administrador; usa el panel o la recuperación de contraseña');
    const rol = await db.query("SELECT id FROM roles WHERE nombre='ADMIN'");
    if (!rol.rowCount) throw new Error('Falta el rol ADMIN; ejecuta las migraciones primero');
    const { rows: [usuario] } = await db.query(`INSERT INTO usuarios(rol_id,nombre_completo,correo_electronico,password_hash,estado_cuenta)
      VALUES($1,$2,$3,$4,'ACTIVO') RETURNING id,correo_electronico`, [rol.rows[0].id, nombre, correo, hash]);
    await db.query('COMMIT');
    return { ...usuario, password };
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.code === '23505') throw new Error('El correo ya está registrado; no se modificó esa cuenta');
    throw error;
  } finally { db.release(); }
}

if (require.main === module) {
  const pool = require('../src/infrastructure/db');
  crearAdminInicial({ pool, hashear: require('../src/infrastructure/contrasenas').hashear, correo: process.argv[2] })
    .then(usuario => {
      console.log('Administrador inicial creado. Guarda estos datos de forma privada; no compartas esta salida.');
      console.log('Correo:', usuario.correo_electronico);
      console.log('Contraseña inicial:', usuario.password);
    })
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { crearAdminInicial };
