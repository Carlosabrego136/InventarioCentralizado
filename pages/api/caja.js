import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

// Vista de solo lectura para Cristian: historial de cortes de caja de
// cualquier tienda. La apertura/corte/retiro real se hace en el punto
// de venta — aquí solo se supervisa.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const { sedeId, desde, hasta } = req.query;
    const params = [];
    const cond = [];
    if (sedeId) { params.push(sedeId); cond.push(`c.sede_id = $${params.length}`); }
    if (desde) { params.push(desde); cond.push(`c.fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); cond.push(`c.fecha <= $${params.length}::date + interval '1 day'`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT c.*, s.nombre AS sede_nombre
       FROM cortes_caja c
       JOIN sedes s ON s.id = c.sede_id
       ${where}
       ORDER BY c.fecha DESC
       LIMIT 200`,
      params
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar cortes de caja' });
  }
}
