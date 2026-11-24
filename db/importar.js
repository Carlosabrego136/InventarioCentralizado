// Carga el catálogo de una tienda desde el CSV del sistema anterior.
//
//   npm run db:importar -- ruta/al/archivo.csv                    -> PRUEBA (no guarda nada)
//   npm run db:importar -- ruta/al/archivo.csv --guardar          -> guarda de verdad
//
// Opciones:
//   --tienda "Zaragoza centro"   tienda destino (por defecto: Zaragoza centro)
//   --forzar                     permite cargar en una tienda que ya tiene
//                                inventario (SOBREESCRIBE su stock y mínimo)
//
// Reglas de la carga:
//  - Todo se guarda en UNA sola transacción: si algo falla, no queda nada a medias.
//  - Existencia negativa se carga en 0.
//  - No se cargan fechas de caducidad (todas quedan vacías).
//  - Mayoreo: se carga el primer nivel (precio + cantidad). Niveles 2-5 se omiten.
//  - Si el producto ya existe (mismo nombre) se reutiliza: NO se cambia su precio,
//    solo se le da de alta el stock en esta tienda. Sirve para cargar las demás
//    tiendas después, una por una.
//  - Sin tocar ventas, usuarios ni otras tiendas.
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

// ---------- argumentos ----------
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
function valorDe(flag, porDefecto) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}
const TIENDA = valorDe('--tienda', 'Zaragoza centro');
const GUARDAR = flags.has('--guardar');
const FORZAR = flags.has('--forzar');
const archivo = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--tienda');

function salir(msg) {
  console.error('\nERROR: ' + msg + '\n');
  process.exit(1);
}

// ---------- CSV ----------
function parseCSV(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  return filas;
}

function num(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).replace(/[$,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const clave = (s) => norm(s).toUpperCase();
const redondea = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const money = (n) => '$' + Number(n).toFixed(2);

const UNIDADES = { PZ: 'pza', PZA: 'pza', PIEZA: 'pza', KG: 'kg', GR: 'gr', G: 'gr', LT: 'lt', L: 'lt', LITRO: 'lt', CAJA: 'pza' };

// ---------- lectura y validación ----------
function leerCatalogo(ruta) {
  if (!ruta) salir('Falta la ruta del CSV. Ejemplo:\n  npm run db:importar -- ~/Downloads/lista.csv');
  if (!fs.existsSync(ruta)) salir(`No encuentro el archivo: ${ruta}`);
  const filas = parseCSV(fs.readFileSync(ruta, 'utf8'));
  if (filas.length < 2) salir('El CSV está vacío.');
  const cab = filas[0].map((h) => h.trim().toUpperCase());
  const idx = (n) => cab.indexOf(n);
  for (const req of ['DESCRIPCION', 'PRECIO', 'UNIDAD', 'EXISTENCIA']) {
    if (idx(req) < 0) salir(`Al CSV le falta la columna "${req}".`);
  }
  const iNom = idx('DESCRIPCION'), iPre = idx('PRECIO'), iUni = idx('UNIDAD'), iEx = idx('EXISTENCIA');
  const iCosto = idx('COSTO'), iMin = idx('CANTIDAD MINIMA');
  const iM1 = idx('MAYOREO 1'), iC1 = idx('MAYOREO CANTIDAD 1');
  const iExtra = [2, 3, 4, 5].map((n) => idx(`MAYOREO ${n}`)).filter((i) => i >= 0);

  const items = [];
  const errores = [];
  const vistos = new Map();
  const rep = { negativos: [], ceros: [], mayoreoAlto: [], nivelesExtra: [], cajas: [], sinCosto: 0 };

  filas.slice(1).forEach((f, k) => {
    const linea = k + 2;
    const nombre = norm(f[iNom] || '');
    if (!nombre) return errores.push(`Línea ${linea}: producto sin nombre`);
    if (nombre.length > 150) return errores.push(`Línea ${linea}: nombre demasiado largo (${nombre.length})`);
    const kNom = clave(nombre);
    if (vistos.has(kNom)) return errores.push(`Línea ${linea}: "${nombre}" está repetido (también en la línea ${vistos.get(kNom)})`);
    vistos.set(kNom, linea);

    const precio = num(f[iPre]);
    if (precio === null || Number.isNaN(precio) || precio <= 0) return errores.push(`Línea ${linea}: "${nombre}" tiene un precio inválido (${f[iPre]})`);
    const uniRaw = norm(f[iUni] || '').toUpperCase();
    const unidad = UNIDADES[uniRaw];
    if (!unidad) return errores.push(`Línea ${linea}: "${nombre}" tiene una unidad no reconocida (${f[iUni]})`);
    if (uniRaw === 'CAJA') rep.cajas.push(nombre);

    if (precio >= 100000000) return errores.push(`Línea ${linea}: "${nombre}" tiene un precio demasiado grande (${f[iPre]})`);
    const exRaw = num(f[iEx]);
    if (Number.isNaN(exRaw)) return errores.push(`Línea ${linea}: "${nombre}" tiene una existencia inválida (${f[iEx]})`);
    const existencia = exRaw === null ? 0 : exRaw;
    if (existencia < 0) rep.negativos.push(`${nombre} (${unidad}): ${existencia}`);
    else if (existencia === 0) rep.ceros.push(nombre);
    const stock = redondea(Math.max(existencia, 0), 3);

    if (Math.abs(existencia) >= 10000000) return errores.push(`Línea ${linea}: "${nombre}" tiene una existencia demasiado grande (${f[iEx]})`);
    const costoRaw = iCosto >= 0 ? num(f[iCosto]) : null;
    const costo = costoRaw === null || Number.isNaN(costoRaw) || costoRaw < 0 ? null : redondea(costoRaw, 2);
    if (costo === null) rep.sinCosto++;

    const minRaw = iMin >= 0 ? num(f[iMin]) : null;
    const minimo = minRaw === null || Number.isNaN(minRaw) || minRaw < 0 ? 0 : redondea(minRaw, 3);

    let pMay = null, cMay = null;
    const m1 = iM1 >= 0 ? num(f[iM1]) : null;
    const c1 = iC1 >= 0 ? num(f[iC1]) : null;
    if (m1 && c1 && m1 > 0 && c1 > 0 && !Number.isNaN(m1) && !Number.isNaN(c1)) {
      pMay = redondea(m1, 2);
      cMay = redondea(c1, 3);
      if (pMay >= precio) rep.mayoreoAlto.push(`${nombre}: precio ${money(precio)}, mayoreo ${money(pMay)} desde ${cMay}`);
    }
    if (iExtra.some((i) => String(f[i] || '').trim() !== '')) rep.nivelesExtra.push(nombre);

    items.push({ nombre, key: kNom, unidad, precio: redondea(precio, 2), costo, stock, minimo, pMay, cMay });
  });
  return { items, errores, rep };
}

// ---------- reporte ----------
function armarReporte(items, rep, extra) {
  const L = [];
  const lista = (titulo, arr, nota) => {
    L.push(`\n== ${titulo} (${arr.length}) ==`);
    if (nota) L.push(nota);
    arr.forEach((x) => L.push('  - ' + x));
  };
  L.push(`REPORTE DE CARGA — tienda: ${TIENDA} — ${GUARDAR ? 'GUARDADO' : 'PRUEBA (no se guardó nada)'}`);
  L.push(`Productos en el archivo: ${items.length}`);
  if (extra) L.push(extra);
  lista('Existencia NEGATIVA — se cargaron en 0, corregir con el conteo', rep.negativos);
  lista('Existencia en 0 — revisar con el conteo', rep.ceros);
  lista('Mayoreo igual o MÁS ALTO que el precio normal — revisar', rep.mayoreoAlto);
  lista('Tenían más de un nivel de mayoreo — solo se cargó el primero', rep.nivelesExtra);
  if (rep.cajas.length) lista('Unidad CAJA — se cargó como pza', rep.cajas);
  return L.join('\n') + '\n';
}

// ---------- base de datos ----------
function nuevoCliente() {
  if (!process.env.DATABASE_URL) salir('Falta DATABASE_URL en .env.local');
  return new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=palafox',
  });
}
const trozos = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  const { items, errores, rep } = leerCatalogo(archivo);
  if (errores.length) {
    console.error('\nEl CSV tiene problemas. No se hizo nada:\n');
    errores.slice(0, 40).forEach((e) => console.error('  - ' + e));
    if (errores.length > 40) console.error(`  ... y ${errores.length - 40} más`);
    process.exit(1);
  }

  const client = nuevoCliente();
  await client.connect();
  try {
    const sedeRes = await client.query('SELECT id, nombre FROM sedes ORDER BY id');
    const sede = sedeRes.rows.find((s) => s.nombre.toLowerCase() === TIENDA.toLowerCase());
    if (!sede) {
      salir(`No existe la tienda "${TIENDA}". Las que hay son: ${sedeRes.rows.map((s) => s.nombre).join(', ')}`);
    }
    const yaTiene = (await client.query('SELECT COUNT(*)::int AS n FROM inventario_sedes WHERE sede_id=$1', [sede.id])).rows[0].n;
    if (yaTiene > 0 && GUARDAR && !FORZAR) {
      salir(`"${sede.nombre}" ya tiene ${yaTiene} productos en inventario. Para no pisar correcciones ya hechas, no se carga nada.\nSi de verdad quieres sobrescribir su stock y mínimo, agrega --forzar.`);
    }

    // ¿Cuáles productos ya existen (mismo nombre)? Esos se reutilizan.
    const exist = await client.query('SELECT id, nombre FROM productos WHERE activo = true');
    const porClave = new Map();
    exist.rows.forEach((p) => { if (!porClave.has(clave(p.nombre))) porClave.set(clave(p.nombre), p.id); });
    const nuevos = items.filter((i) => !porClave.has(i.key));
    const reutilizados = items.length - nuevos.length;
    const enAlerta = items.filter((i) => i.minimo > 0 && i.stock <= i.minimo).length;
    const conMayoreo = items.filter((i) => i.pMay).length;

    const resumen = [
      `Tienda destino:          ${sede.nombre}`,
      `Productos en el CSV:     ${items.length}`,
      `  - nuevos:              ${nuevos.length}`,
      `  - ya existían:         ${reutilizados} (se reutilizan, no se cambia su precio)`,
      `Con mayoreo:             ${conMayoreo}`,
      `Existencia negativa->0:  ${rep.negativos.length}`,
      `En 0 desde el inicio:    ${rep.ceros.length}`,
      `Arrancarían en alerta de resurtir (stock <= mínimo): ${enAlerta}`,
      `Caducidades:             todas vacías`,
      yaTiene > 0 ? `OJO: esta tienda ya tenía ${yaTiene} productos en inventario.` : null,
    ].filter(Boolean).join('\n');

    console.log('\n' + resumen + '\n');

    const archivoReporte = 'reporte-carga.txt';
    fs.writeFileSync(archivoReporte, armarReporte(items, rep, resumen));
    console.log(`Detalle de lo que hay que revisar: ${archivoReporte}\n`);

    if (!GUARDAR) {
      console.log('Esto fue solo una PRUEBA: no se guardó nada.');
      console.log('Si el resumen se ve bien, corre lo mismo agregando --guardar al final.\n');
      return;
    }

    // ---------- guardado: todo o nada ----------
    await client.query('BEGIN');
    try {
      for (const lote of trozos(nuevos, 200)) {
        const r = await client.query(
          `INSERT INTO productos (nombre, unidad_medida, precio_venta, costo_compra, precio_mayoreo, cantidad_mayoreo)
           SELECT * FROM unnest($1::text[], $2::text[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[])
           RETURNING id, nombre`,
          [lote.map((i) => i.nombre), lote.map((i) => i.unidad), lote.map((i) => i.precio),
           lote.map((i) => i.costo), lote.map((i) => i.pMay), lote.map((i) => i.cMay)]
        );
        r.rows.forEach((p) => porClave.set(clave(p.nombre), p.id));
      }

      for (const lote of trozos(items, 200)) {
        const ids = lote.map((i) => porClave.get(i.key));
        if (ids.some((x) => !x)) throw new Error('No se pudo asignar un producto: se cancela todo.');
        await client.query(
          `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo, activo, fecha_caducidad, alerta_desde)
           SELECT $1, t.pid, t.stock, t.minimo, true, NULL,
                  CASE WHEN t.minimo > 0 AND t.stock <= t.minimo THEN NOW() ELSE NULL END
           FROM unnest($2::int[], $3::numeric[], $4::numeric[]) AS t(pid, stock, minimo)
           ON CONFLICT (sede_id, producto_id) DO UPDATE SET
             stock_actual = EXCLUDED.stock_actual, stock_minimo = EXCLUDED.stock_minimo,
             activo = true, fecha_caducidad = NULL, alerta_desde = EXCLUDED.alerta_desde`,
          [sede.id, ids, lote.map((i) => i.stock), lote.map((i) => i.minimo)]
        );
      }

      await client.query(
        `INSERT INTO bitacora (sede_id, origen, tipo, descripcion) VALUES ($1, $2, $3, $4)`,
        [sede.id, 'Carga de catálogo', 'catalogo_cargado',
         `Se cargaron ${items.length} productos en ${sede.nombre} (${nuevos.length} nuevos, ${reutilizados} ya existían)`]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // ---------- verificación ----------
    const v = await client.query(
      `SELECT COUNT(*)::int AS productos,
              COUNT(*) FILTER (WHERE i.alerta_desde IS NOT NULL)::int AS alertas,
              COUNT(*) FILTER (WHERE i.fecha_caducidad IS NOT NULL)::int AS con_caducidad
       FROM inventario_sedes i JOIN productos p ON p.id = i.producto_id
       WHERE i.sede_id = $1 AND i.activo AND p.activo`,
      [sede.id]
    );
    const x = v.rows[0];
    console.log(`GUARDADO. ${sede.nombre} ahora tiene ${x.productos} productos activos, ${x.alertas} en alerta, ${x.con_caducidad} con caducidad.`);
    if (x.productos < items.length) console.log('AVISO: hay menos productos activos que en el CSV. Revisa.');
    console.log('\nSiguiente: entra al POS de la tienda, busca un par de productos y revisa el stock.\n');
  } catch (err) {
    console.error('\nError (no se guardó nada nuevo):', err.message, '\n');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
