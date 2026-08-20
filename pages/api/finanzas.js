import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

function rangoDias(desde, hasta) {
  const dias = [];
  let d = new Date(desde + 'T00:00:00');
  const fin = new Date(hasta + 'T00:00:00');
  while (d <= fin) {
    dias.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const { sedeId } = req.query;
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = req.query.desde || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const hasta = req.query.hasta || hoy;

    const baseParams = [desde, hasta];
    const filtroVentas = sedeId ? 'AND v.sede_id = $3' : '';
    const paramsVentas = sedeId ? [...baseParams, sedeId] : baseParams;

    const { rows: ingresosRows } = await query(
      `SELECT to_char(v.fecha, 'YYYY-MM-DD') AS dia, SUM(v.total) AS total
       FROM ventas v
       WHERE v.fecha::date BETWEEN $1 AND $2 ${filtroVentas}
       GROUP BY dia`,
      paramsVentas
    );

    const { rows: costoRows } = await query(
      `SELECT to_char(v.fecha, 'YYYY-MM-DD') AS dia, SUM(d.cantidad * COALESCE(p.costo_compra,0)) AS total
       FROM ventas v
       JOIN detalle_ventas d ON d.venta_id = v.id
       LEFT JOIN productos p ON p.id = d.producto_id
       WHERE v.fecha::date BETWEEN $1 AND $2 ${filtroVentas}
       GROUP BY dia`,
      paramsVentas
    );

    const filtroGastos = sedeId === 'general' ? 'AND g.sede_id IS NULL' : sedeId ? 'AND g.sede_id = $3' : '';
    const paramsGastos = sedeId && sedeId !== 'general' ? [...baseParams, sedeId] : baseParams;
    const { rows: gastoRows } = await query(
      `SELECT to_char(g.fecha, 'YYYY-MM-DD') AS dia, SUM(g.monto) AS total
       FROM gastos g
       WHERE g.fecha BETWEEN $1 AND $2 ${filtroGastos}
       GROUP BY dia`,
      paramsGastos
    );

    const dias = rangoDias(desde, hasta);
    const mapIngresos = Object.fromEntries(ingresosRows.map((r) => [r.dia, Number(r.total)]));
    const mapCosto = Object.fromEntries(costoRows.map((r) => [r.dia, Number(r.total)]));
    const mapGasto = Object.fromEntries(gastoRows.map((r) => [r.dia, Number(r.total)]));

    const serie = dias.map((dia) => {
      const ingresos = mapIngresos[dia] || 0;
      const costo = mapCosto[dia] || 0;
      const gastos = mapGasto[dia] || 0;
      return { dia, ingresos, costo, gastos, ganancia: ingresos - costo - gastos };
    });

    const totales = serie.reduce(
      (acc, d) => ({
        ingresos: acc.ingresos + d.ingresos,
        costo: acc.costo + d.costo,
        gastos: acc.gastos + d.gastos,
        ganancia: acc.ganancia + d.ganancia,
      }),
      { ingresos: 0, costo: 0, gastos: 0, ganancia: 0 }
    );

    // Comparativo: mismo rango, desglosado por cada sede (para ver cuál gana más)
    const { rows: ingresoPorSede } = await query(
      `SELECT s.id AS sede_id, s.nombre AS sede_nombre, COALESCE(SUM(v.total),0) AS ingresos
       FROM sedes s
       LEFT JOIN ventas v ON v.sede_id = s.id AND v.fecha::date BETWEEN $1 AND $2
       GROUP BY s.id, s.nombre
       ORDER BY s.id`,
      baseParams
    );
    const { rows: costoPorSedeRows } = await query(
      `SELECT v.sede_id, SUM(d.cantidad * COALESCE(p.costo_compra,0)) AS costo
       FROM ventas v
       JOIN detalle_ventas d ON d.venta_id = v.id
       LEFT JOIN productos p ON p.id = d.producto_id
       WHERE v.fecha::date BETWEEN $1 AND $2
       GROUP BY v.sede_id`,
      baseParams
    );
    const { rows: gastoPorSedeRows } = await query(
      `SELECT sede_id, SUM(monto) AS gastos
       FROM gastos
       WHERE fecha BETWEEN $1 AND $2 AND sede_id IS NOT NULL
       GROUP BY sede_id`,
      baseParams
    );
    const { rows: gastosGeneralesRows } = await query(
      `SELECT COALESCE(SUM(monto),0) AS total FROM gastos WHERE fecha BETWEEN $1 AND $2 AND sede_id IS NULL`,
      baseParams
    );

    const costoMap = Object.fromEntries(costoPorSedeRows.map((r) => [r.sede_id, Number(r.costo)]));
    const gastoMap = Object.fromEntries(gastoPorSedeRows.map((r) => [r.sede_id, Number(r.gastos)]));

    const comparativo = ingresoPorSede.map((s) => {
      const ingresos = Number(s.ingresos);
      const costo = costoMap[s.sede_id] || 0;
      const gastosSede = gastoMap[s.sede_id] || 0;
      return { sede_id: s.sede_id, sede_nombre: s.sede_nombre, ingresos, costo, gastos: gastosSede, ganancia: ingresos - costo - gastosSede };
    });

    res.status(200).json({
      desde, hasta, serie, totales, comparativo,
      gastosGenerales: Number(gastosGeneralesRows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular finanzas' });
  }
}
