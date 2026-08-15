// Conexión a Postgres (Aiven). Un solo pool reutilizado en toda la app.
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    // Quitamos ?sslmode=... de la URL: versiones recientes de pg-connection-string
    // lo interpretan como "verify-full" y truena contra el certificado de Aiven
    // (self signed certificate in certificate chain). El SSL lo controlamos
    // explícitamente abajo con rejectUnauthorized:false.
    const connectionString = (process.env.DATABASE_URL || '').split('?')[0];
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // requerido por Aiven
      // Aísla este proyecto en su propio schema dentro del mismo servicio de
      // Aiven, para no tocar las tablas de Itzli ni de otros proyectos.
      options: '-c search_path=palafox',
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction };