// Aplica SOLO las migraciones de db/schema.sql (todas son idempotentes:
// se pueden correr las veces que sea). NO carga productos de ejemplo y NO
// borra datos — a diferencia de "db:init", que además corre db/seed.sql.
// Uso: npm run db:migrar
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=palafox',
  });
  await client.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Aplicando migraciones...');
    await client.query(schema);

    const { rows } = await client.query(
      `SELECT data_type, character_maximum_length FROM information_schema.columns
       WHERE table_schema = 'palafox' AND table_name = 'usuarios' AND column_name = 'password_hash'`
    );
    const col = rows[0];
    if (col && col.data_type === 'text') {
      console.log('Listo. La columna password_hash ya acepta contraseñas cifradas completas: ya se pueden crear usuarios.');
    } else {
      console.log('AVISO: password_hash sigue como', col ? `${col.data_type}(${col.character_maximum_length})` : 'inexistente', '— revisa.');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error al migrar:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
