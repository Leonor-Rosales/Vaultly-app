const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { Pool } = require('pg');
const { listarMigraciones, migrar } = require('../../src/infrastructure/migraciones');
const { crearArchivoRepositorio } = require('../../src/infrastructure/archivoRepositorio');
const loadWith = require('../loadWith');

test('migraciones en PostgreSQL temporal: instalación, variantes históricas y repetición', async t => {
  const url = new URL(process.env.TEST_MIGRATIONS_DATABASE_URL || 'http://invalid');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/vaultly_migraciones_test',
    'Se requiere TEST_MIGRATIONS_DATABASE_URL hacia la base local exclusiva vaultly_migraciones_test');
  const admin = new Pool({ connectionString: url.toString() });
  t.after(() => admin.end());
  await admin.query('CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public');
  const migraciones = listarMigraciones();
  const sql = nombre => migraciones.find(m => m.nombre === nombre).sql;

  for (const modo of ['nueva-cli', 'nueva-docker', 'anterior', '06-reservas', '06-biblioteca', 'ambas-06', 'contador-sin-historial']) {
    await t.test(modo, async () => {
      const schema = 'test_' + randomUUID().replaceAll('-', '');
      await admin.query(`CREATE SCHEMA ${schema}`);
      const pool = new Pool({ connectionString: url.toString(), options: `-c search_path=${schema},public` });
      try {
        if (modo === 'nueva-docker') {
          // Mismo orden y contenido que /docker-entrypoint-initdb.d.
          for (const m of migraciones) await pool.query(m.sql);
        } else if (modo !== 'nueva-cli') {
          // Esquema anterior funcional, sin la restricción de longitud añadida por el migrador JS.
          await pool.query(sql('01_schema.sql').replace(
            /,\r?\n    CONSTRAINT etiquetas_longitud CHECK \(char_length\(nombre\) BETWEEN 1 AND 30\)/, ''));
          for (const nombre of ['02_seeds.sql', '03_planes_cuotas.sql', '04_descargas_biblioteca.sql']) await pool.query(sql(nombre));
          if (['06-biblioteca', 'ambas-06', 'contador-sin-historial'].includes(modo)) await pool.query(sql('06_biblioteca.sql'));
          // El antiguo 06_reservas_subida.sql era vacío: ejecutarlo no modificaba nada.
          if (['06-reservas', 'ambas-06'].includes(modo)) await pool.query('');
          if (modo === 'contador-sin-historial') {
            await pool.query(sql('07_contador_descargas.sql').replace(
              "INSERT INTO migraciones_vaultly(nombre) VALUES ('07_contador_descargas') ON CONFLICT DO NOTHING;", ''));
          }
        }

        const cli = async () => promisify(execFile)(process.execPath, ['scripts/migrar.js'], {
          cwd: path.resolve(__dirname, '../..'),
          env: { ...process.env, DB_HOST: url.hostname, DB_PORT: url.port, DB_NAME: 'vaultly_migraciones_test',
            DB_USER: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            PGOPTIONS: `-c search_path=${schema},public` },
        });
        if (modo === 'nueva-cli') await cli();
        const usuario = randomUUID(), archivo = randomUUID();
        await pool.query("INSERT INTO usuarios(id,rol_id,nombre_completo,correo_electronico,password_hash) VALUES($1,2,'Prueba migración',$2,'hash-ficticio')", [usuario, `${usuario}@example.test`]);
        await pool.query("INSERT INTO archivos(id,usuario_id,nombre_original,nombre_objeto_minio,ruta_minio,tamanio_bytes,tipo_mime,es_publica) VALUES($1::uuid,$2,'Guía.pdf',$1::uuid::text,'fixture',4,'application/pdf',true)", [archivo, usuario]);
        await pool.query('UPDATE suscripciones SET descargas_consumidas_ciclo=1 WHERE usuario_id=$1', [usuario]);
        await pool.query("INSERT INTO ciclos_descargas(usuario_id,inicio,fin,consumidas) VALUES($1,now(),now()+interval '1 day',1)", [usuario]);
        if (modo === 'contador-sin-historial') await pool.query('UPDATE archivos SET descargas=8 WHERE id=$1', [archivo]);

        await cli();
        const repo = loadWith(path.resolve(__dirname, '../../src/infrastructure/bibliotecarepositorio.js'), { './db': pool });
        const resultado = await repo.listarArchivos({ q: 'guia', etiquetaIds: [], orden: 'recientes', pagina: 1 });
        assert.equal(resultado.total, 1);
        assert.equal(resultado.items[0].descargas, modo === 'contador-sin-historial' ? 8 : 0);
        const { rows: [columna] } = await pool.query("SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='archivos' AND column_name='descargas'", [schema]);
        assert.equal(columna.data_type, 'bigint');
        assert.equal(columna.is_nullable, 'NO');
        assert.match(columna.column_default, /0/);
        await assert.rejects(pool.query('UPDATE archivos SET descargas=-1 WHERE id=$1', [archivo]), { code: '23514' });
        await assert.rejects(pool.query('UPDATE archivos SET descargas=NULL WHERE id=$1', [archivo]), { code: '23502' });
        await crearArchivoRepositorio(pool).incrementarDescargas(archivo);
        const foto = async () => {
          const resultados = [];
          for (const tabla of ['usuarios', 'archivos', 'suscripciones', 'ciclos_descargas', 'migraciones_vaultly']) {
            resultados.push((await pool.query(`SELECT row_to_json(t) AS fila FROM ${tabla} t ORDER BY row_to_json(t)::text`)).rows);
          }
          return resultados;
        };
        const antes = await foto();
        await cli();
        await migrar(pool, () => {});
        assert.deepEqual(await foto(), antes, 'Repetir conserva datos, contadores y fechas del historial');
        assert.equal((await pool.query('SELECT consumidas FROM ciclos_descargas WHERE usuario_id=$1', [usuario])).rows[0].consumidas, '1');
        assert.equal((await pool.query('SELECT descargas_consumidas_ciclo FROM suscripciones WHERE usuario_id=$1', [usuario])).rows[0].descargas_consumidas_ciclo, 1);
        assert.equal((await repo.listarArchivos({ q: '', etiquetaIds: [], orden: 'recientes', pagina: 1 })).items[0].descargas, modo === 'contador-sin-historial' ? 9 : 1);
      } finally {
        await pool.end();
        // Se conservan los esquemas exclusivamente temporales para inspección; no se borra ningún dato.
      }
    });
  }
});
