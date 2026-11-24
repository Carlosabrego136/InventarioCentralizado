// Borra el catálogo y todo el historial de prueba para arrancar limpio.
// Se conservan: sedes, usuarios y datos del ticket.
//
// Por seguridad NO borra nada si no se confirma:
//   npm run db:limpiar                     -> solo muestra qué se borraría
//   npm run db:limpiar -- --confirmar      -> borra de verdad
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TABLAS = [
  ['productos', 'productos'],
  ['inventario_sedes', 'registros de inventario por tienda'],
  ['ventas', 'ventas'],
  ['detalle_ventas', 'renglones de venta'],
  ['traspasos', 'traspasos'],
  ['bitacora', 'eventos de bitácora'],
  ['cortes_caja', 'cortes de caja'],
  ['movimientos_caja', 'movimientos de efectivo'],
  ['gastos', 'gastos'],
  ['ventas_en_espera', 'tickets en espera'],
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }
  const confirmar = process.argv.includes('--confirmar');
  const client = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=palafox',
  });
  await client.connect();

  try {
    console.log('Esto es lo que hay ahorita en la base de datos:\n');
    for (const [tabla, etiqueta] of TABLAS) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`);
      console.log(`  ${String(rows[0].n).padStart(7)}  ${etiqueta}`);
    }
    console.log('\nSe conservan: sedes, usuarios y datos del ticket de cada tienda.');

    if (!confirmar) {
      console.log('\nNo se borró nada. Si es lo que quieres, corre:');
      console.log('  npm run db:limpiar -- --confirmar');
      return;
    }

    const sql = fs.readFileSync(path.join(__dirname, 'limpiar.sql'), 'utf8');
    console.log('\nBorrando...');
    await client.query(sql);
    console.log('Listo. Todo lo anterior quedó vacío. Las sedes y los usuarios siguen ahí.');
  } catch (err) {
    console.error('Error al limpiar:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
