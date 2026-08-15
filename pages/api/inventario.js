import { query } from '../../lib/db';

export default async function handler(req, res) {
  const { sedeId } = req.query;
  if (!sedeId) return res.status(400).json({ error: 'Falta sedeId' });

  if (req.method === 'GET') {
    try {
      const sedeRes = await query('SELECT * FROM sedes WHERE id=$1', [sedeId]);
      if (sedeRes.rows.length === 0) return res.status(404).json({ error: 'Sede no encontrada' });
      const reducido = sedeRes.rows[0].catalogo_reducido;

      const { rows } = await query(
        `SELECT p.id AS producto_id, p.sku_codigo, p.nombre, p.unidad_medida, p.precio_venta,
                COALESCE(i.stock_actual, 0) AS stock_actual,
                COALESCE(i.stock_minimo, 0) AS stock_minimo
         FROM productos p
         LEFT JOIN inventario_sedes i ON i.producto_id = p.id AND i.sede_id = $1
         WHERE ($2::boolean = false OR p.disponible_reducido = true)
         ORDER BY p.id`,
        [sedeId, reducido]
      );
      return res.status(200).json({ sede: sedeRes.rows[0], inventario: rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar inventario' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { productoId, stockMinimo } = req.body;
      if (productoId === undefined || stockMinimo === undefined) {
        return res.status(400).json({ error: 'Faltan datos' });
      }
      await query(
        `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo)
         VALUES ($1, $2, 0, $3)
         ON CONFLICT (sede_id, producto_id) DO UPDATE SET stock_minimo = EXCLUDED.stock_minimo`,
        [sedeId, productoId, stockMinimo]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el mínimo' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
