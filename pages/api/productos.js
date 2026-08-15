import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { sedeId } = req.query;
    if (sedeId) {
      const sedeRes = await query('SELECT catalogo_reducido FROM sedes WHERE id=$1', [sedeId]);
      if (sedeRes.rows.length === 0) return res.status(404).json({ error: 'Sede no encontrada' });
      const reducido = sedeRes.rows[0].catalogo_reducido;
      const prodRes = reducido
        ? await query('SELECT * FROM productos WHERE disponible_reducido = true ORDER BY id')
        : await query('SELECT * FROM productos ORDER BY id');
      return res.status(200).json(prodRes.rows);
    }
    const { rows } = await query('SELECT * FROM productos ORDER BY id');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar productos' });
  }
}
