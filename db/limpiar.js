// Borra todo el catálogo de prueba (productos, inventario, traspasos,
// ventas y bitácora) para arrancar limpio. Las sedes se conservan.
// Uso: npm run db:limpiar
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL.split('?')[0];
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=palafox',
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'limpiar.sql'), 'utf8');
    console.log('Borrando catálogo de prueba...');
    await pool.query(sql);
    console.log('Listo. Productos, inventario, traspasos, ventas y bitácora quedaron vacíos.');
    console.log('Las 4 sedes (Bodega + 3 tiendas) siguen ahí, listas para recibir el catálogo real.');
  } catch (err) {
    console.error('Error al limpiar:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
