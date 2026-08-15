import { query, withTransaction } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { rows } = await query(
        `SELECT t.*, p.nombre AS producto_nombre, p.unidad_medida,
                so.nombre AS origen_nombre, sd.nombre AS destino_nombre
         FROM traspasos t
         JOIN productos p ON p.id = t.producto_id
         JOIN sedes so ON so.id = t.origen_id
         JOIN sedes sd ON sd.id = t.destino_id
         ORDER BY t.fecha DESC
         LIMIT 25`
      );
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar traspasos' });
    }
  }

  if (req.method === 'POST') {
    const { origenId, destinoId, productoId, cantidad } = req.body;
    if (!origenId || !destinoId || !productoId || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos' });
    }
    if (Number(origenId) === Number(destinoId)) {
      return res.status(400).json({ error: 'El origen y destino no pueden ser la misma sede' });
    }

    try {
      const result = await withTransaction(async (client) => {
        const destSedeRes = await client.query('SELECT catalogo_reducido FROM sedes WHERE id=$1', [destinoId]);
        if (destSedeRes.rows.length === 0) throw new Error('Sede destino no encontrada');

        if (destSedeRes.rows[0].catalogo_reducido) {
          const prodRes = await client.query('SELECT disponible_reducido FROM productos WHERE id=$1', [productoId]);
          if (!prodRes.rows[0]?.disponible_reducido) {
            throw new Error('Ese producto no está habilitado para el catálogo reducido de esta tienda');
          }
        }

        const origenRes = await client.query(
          'SELECT stock_actual FROM inventario_sedes WHERE sede_id=$1 AND producto_id=$2 FOR UPDATE',
          [origenId, productoId]
        );
        const stockOrigen = Number(origenRes.rows[0]?.stock_actual || 0);
        if (stockOrigen < cantidad) throw new Error('Stock insuficiente en la sede de origen');

        await client.query(
          'UPDATE inventario_sedes SET stock_actual = stock_actual - $1 WHERE sede_id=$2 AND producto_id=$3',
          [cantidad, origenId, productoId]
        );

        await client.query(
          `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (sede_id, producto_id) DO UPDATE
           SET stock_actual = inventario_sedes.stock_actual + EXCLUDED.stock_actual`,
          [destinoId, productoId, cantidad]
        );

        const trasRes = await client.query(
          `INSERT INTO traspasos (origen_id, destino_id, producto_id, cantidad)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [origenId, destinoId, productoId, cantidad]
        );
        return trasRes.rows[0];
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al realizar el traspaso' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
