import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';
import { esFechaISO, inicioDiaSQL, inicioDiaSiguienteSQL } from '../../lib/fechas';

// Vista de solo lectura para Cristian: historial de cortes de caja de
// cualquier tienda. La apertura/corte/retiro real se hace en el punto
// de venta — aquí solo se supervisa.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const { sedeId, desde, hasta } = req.query;
    if ((desde && !esFechaISO(desde)) || (hasta && !esFechaISO(hasta))) {
      return res.status(400).json({ error: 'Fecha no válida' });
    }
    const params = [];
    const cond = [];
    if (sedeId) { params.push(sedeId); cond.push(`c.sede_id = $${params.length}`); }
    // Los días se cuentan en hora de México (12:00 am a 12:00 am).
    if (desde) { params.push(desde); cond.push(`c.fecha >= ${inicioDiaSQL(`$${params.length}`)}`); }
    if (hasta) { params.push(hasta); cond.push(`c.fecha < ${inicioDiaSiguienteSQL(`$${params.length}`)}`); }
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
