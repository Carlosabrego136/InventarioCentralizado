import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { rows: stock } = await query(
      `SELECT s.id AS sede_id, s.nombre AS sede_nombre,
              p.id AS producto_id, p.nombre AS producto_nombre, p.unidad_medida,
              i.stock_actual, i.stock_minimo, i.alerta_desde
       FROM inventario_sedes i
       JOIN sedes s ON s.id = i.sede_id
       JOIN productos p ON p.id = i.producto_id
       WHERE i.activo = true AND p.activo = true
             AND i.stock_minimo > 0 AND i.stock_actual <= i.stock_minimo
       ORDER BY i.alerta_desde ASC NULLS LAST`
    );

    const { rows: caducidad } = await query(
      `SELECT s.id AS sede_id, s.nombre AS sede_nombre,
              p.id AS producto_id, p.nombre AS producto_nombre, p.unidad_medida,
              i.fecha_caducidad,
              (i.fecha_caducidad < CURRENT_DATE) AS ya_caduco
       FROM inventario_sedes i
       JOIN sedes s ON s.id = i.sede_id
       JOIN productos p ON p.id = i.producto_id
       WHERE i.activo = true AND p.activo = true
             AND i.fecha_caducidad IS NOT NULL
             AND i.fecha_caducidad <= CURRENT_DATE + INTERVAL '15 days'
       ORDER BY i.fecha_caducidad ASC`
    );

    res.status(200).json({ stock, caducidad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar alertas' });
  }
}
