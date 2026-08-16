import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

function construirFiltro(query_params) {
  const { sedeId, desde, hasta } = query_params;
  const params = [];
  const condiciones = [];
  if (sedeId) { params.push(sedeId); condiciones.push(`v.sede_id = $${params.length}`); }
  if (desde) { params.push(desde); condiciones.push(`v.fecha >= $${params.length}`); }
  if (hasta) { params.push(hasta); condiciones.push(`v.fecha <= $${params.length}::timestamp + interval '1 day'`); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return { where, params };
}

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { where, params } = construirFiltro(req.query);

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

      return res.status(200).json({ detalle, totales });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar reportes' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { where, params } = construirFiltro(req.query);
      // Solo permitimos limpiar lo que coincide con el filtro actual —
      // nunca un "borra todo" implícito sin haber elegido rango/tienda.
      if (!where) {
        return res.status(400).json({ error: 'Elige al menos una tienda o un rango de fechas antes de limpiar' });
      }

      const ventasIds = await query(`SELECT v.id FROM ventas v ${where}`, params);
      const ids = ventasIds.rows.map((r) => r.id);
      if (ids.length === 0) return res.status(200).json({ ok: true, eliminadas: 0 });

      await query(`DELETE FROM detalle_ventas WHERE venta_id = ANY($1::int[])`, [ids]);
      await query(`DELETE FROM ventas WHERE id = ANY($1::int[])`, [ids]);

      await logEvento({
        sedeId: req.query.sedeId || null,
        origen: 'Cristian (admin)',
        tipo: 'historial_limpiado',
        descripcion: `Limpió ${ids.length} venta(s) del historial de reportes${req.query.desde ? ` (desde ${req.query.desde}${req.query.hasta ? ` hasta ${req.query.hasta}` : ''})` : ''}`,
      });

      return res.status(200).json({ ok: true, eliminadas: ids.length });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al limpiar el historial' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
