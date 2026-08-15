// Inicializa la base de datos: crea las tablas y carga el catálogo inicial.
// Uso: npm run db:init  (requiere DATABASE_URL en .env.local)
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Copia .env.example a .env.local y pon tu cadena de conexión de Aiven.');
    process.exit(1);
  }

  // Quitamos ?sslmode=... de la URL por la misma razón que en lib/db.js:
  // evita el error "self signed certificate in certificate chain" con Aiven.
  const connectionString = process.env.DATABASE_URL.split('?')[0];
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=palafox',
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

    console.log('Creando tablas...');
    await pool.query(schema);

    console.log('Cargando catálogo y stock inicial...');
    await pool.query(seed);

    console.log('Listo. Base de datos inicializada correctamente.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();