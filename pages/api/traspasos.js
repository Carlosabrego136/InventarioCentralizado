import { query, withTransaction, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

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
        const origenRes = await client.query(
          'SELECT stock_actual, stock_minimo, alerta_desde FROM inventario_sedes WHERE sede_id=$1 AND producto_id=$2 FOR UPDATE',
          [origenId, productoId]
        );
        const stockOrigenAntes = Number(origenRes.rows[0]?.stock_actual || 0);
        const minimoOrigen = Number(origenRes.rows[0]?.stock_minimo || 0);
        if (stockOrigenAntes < cantidad) throw new Error('Stock insuficiente en la sede de origen');
        const stockOrigenDespues = stockOrigenAntes - cantidad;
        const bajoAntesOrigen = minimoOrigen > 0 && stockOrigenAntes <= minimoOrigen;
        const bajoDespuesOrigen = minimoOrigen > 0 && stockOrigenDespues <= minimoOrigen;

        await client.query(
          `UPDATE inventario_sedes SET stock_actual = $1,
             alerta_desde = ${bajoDespuesOrigen && !bajoAntesOrigen ? 'NOW()' : bajoDespuesOrigen ? 'alerta_desde' : 'NULL'}
           WHERE sede_id=$2 AND producto_id=$3`,
          [stockOrigenDespues, origenId, productoId]
        );

        // El traspaso automáticamente le da de alta el producto en la
        // tienda destino si todavía no lo tenía en su catálogo.
        const destRes = await client.query(
          'SELECT stock_actual, stock_minimo FROM inventario_sedes WHERE sede_id=$1 AND producto_id=$2 FOR UPDATE',
          [destinoId, productoId]
        );
        const stockDestAntes = Number(destRes.rows[0]?.stock_actual || 0);
        const minimoDest = Number(destRes.rows[0]?.stock_minimo || 0);
        const stockDestDespues = stockDestAntes + cantidad;
        const bajoDespuesDest = minimoDest > 0 && stockDestDespues <= minimoDest;

        await client.query(
          `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo, activo, alerta_desde)
           VALUES ($1, $2, $3, 0, true, ${bajoDespuesDest ? 'NOW()' : 'NULL'})
           ON CONFLICT (sede_id, producto_id) DO UPDATE
           SET stock_actual = inventario_sedes.stock_actual + EXCLUDED.stock_actual,
               activo = true,
               alerta_desde = ${bajoDespuesDest ? 'COALESCE(inventario_sedes.alerta_desde, NOW())' : 'NULL'}`,
          [destinoId, productoId, cantidad]
        );

        const trasRes = await client.query(
          `INSERT INTO traspasos (origen_id, destino_id, producto_id, cantidad)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [origenId, destinoId, productoId, cantidad]
        );

        const [prodRes, origenRes2, destRes2] = await Promise.all([
          client.query('SELECT nombre, unidad_medida FROM productos WHERE id=$1', [productoId]),
          client.query('SELECT nombre FROM sedes WHERE id=$1', [origenId]),
          client.query('SELECT nombre FROM sedes WHERE id=$1', [destinoId]),
        ]);

        return {
          traspaso: trasRes.rows[0],
          descripcion: `Traspaso de ${cantidad} ${prodRes.rows[0]?.unidad_medida || ''} de "${prodRes.rows[0]?.nombre}" — ${origenRes2.rows[0]?.nombre} → ${destRes2.rows[0]?.nombre}`,
        };
      });

      await logEvento({
        sedeId: destinoId,
        origen: 'Cristian (admin)',
        tipo: 'traspaso',
        descripcion: result.descripcion,
      });

      return res.status(201).json(result.traspaso);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'Error al realizar el traspaso' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
