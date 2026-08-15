import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

// Última venta registrada por sede — así Cristian ve qué tienda tiene
// movimiento reciente y cuál lleva rato sin vender nada.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { rows } = await query(
      `SELECT s.id AS sede_id, MAX(v.fecha) AS ultima_venta
       FROM sedes s
       LEFT JOIN ventas v ON v.sede_id = s.id
       WHERE s.tipo = 'tienda'
       GROUP BY s.id`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar actividad' });
  }
}
