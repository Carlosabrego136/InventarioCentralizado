// Fechas en hora de México.
//
// La base de datos guarda las columnas "fecha" (TIMESTAMP) en hora UTC, que va
// 6 horas adelante de México. Si un filtro de "del 25 al 25" se compara directo,
// el día se corta a las 6 de la tarde de México. Estos ayudantes calculan los
// días con la hora de México (de las 12 de la noche a las 12 de la noche) sin
// cambiar ni mover ningún dato guardado.

export const TZ = 'America/Mexico_City';

// ---------- SQL (para armar consultas) ----------

// Día de México (tipo DATE) de una columna TIMESTAMP guardada en UTC.
export const diaMX = (columna) =>
  `((${columna} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')::date`;

// Hoy en México (tipo DATE).
export const hoyMX_SQL = `(NOW() AT TIME ZONE '${TZ}')::date`;

// Instante UTC (TIMESTAMP) en que EMPIEZA el día de México indicado por $n.
export const inicioDiaSQL = (param) =>
  `((${param}::date)::timestamp AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'`;

// Instante UTC (TIMESTAMP) en que EMPIEZA el día siguiente (límite exclusivo).
export const inicioDiaSiguienteSQL = (param) =>
  `(((${param}::date + 1))::timestamp AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'`;

// ¿Es una fecha con formato AAAA-MM-DD válida?
export function esFechaISO(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// ---------- JavaScript (servidor y navegador) ----------

// Fecha de hoy en México como AAAA-MM-DD, sin importar la zona del equipo
// o del servidor.
export function hoyMX() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

// Suma (o resta) días a una fecha AAAA-MM-DD.
export function sumarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 'AAAA-MM-DD' (o con hora) -> 'DD/MM/AAAA' sin pasar por zonas horarias.
export function fechaCorta(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
