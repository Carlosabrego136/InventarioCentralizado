import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const { sedeId, desde, hasta } = req.query;
    const params = [];
    const condiciones = [];
    if (sedeId) { params.push(sedeId); condiciones.push(`v.sede_id = $${params.length}`); }
    if (desde) { params.push(desde); condiciones.push(`v.fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); condiciones.push(`v.fecha <= $${params.length}::timestamp + interval '1 day'`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const { rows: detalle } = await query(
      `SELECT v.id AS venta_id, v.fecha, v.sede_id, s.nombre AS sede_nombre,
              d.cantidad, d.subtotal, d.precio_unitario,
              COALESCE(p.nombre, d.nombre_libre, 'Producto eliminado') AS producto_nombre,
              COALESCE(p.unidad_medida, d.unidad_libre) AS unidad_medida
       FROM ventas v
       JOIN sedes s ON s.id = v.sede_id
       JOIN detalle_ventas d ON d.venta_id = v.id
       LEFT JOIN productos p ON p.id = d.producto_id
       ${where}
       ORDER BY v.fecha DESC
       LIMIT 500`,
      params
    );

    const { rows: totales } = await query(
      `SELECT s.id AS sede_id, s.nombre AS sede_nombre,
              COUNT(DISTINCT v.id) AS num_ventas, COALESCE(SUM(v.total),0) AS total
       FROM ventas v
       JOIN sedes s ON s.id = v.sede_id
       ${where}
       GROUP BY s.id, s.nombre
       ORDER BY s.id`,
      params
    );

    res.status(200).json({ detalle, totales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar reportes' });
  }
}
