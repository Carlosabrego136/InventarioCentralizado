import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { rows } = await query(
      `SELECT b.*, s.nombre AS sede_nombre
       FROM bitacora b
       LEFT JOIN sedes s ON s.id = b.sede_id
       ORDER BY b.fecha DESC
       LIMIT 100`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar la bitácora' });
  }
}
