import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { rows } = await query(
        `SELECT b.*, s.nombre AS sede_nombre
         FROM bitacora b
         LEFT JOIN sedes s ON s.id = b.sede_id
         ORDER BY b.fecha DESC
         LIMIT 150`
      );
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar la bitácora' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { rows } = await query('DELETE FROM bitacora RETURNING id');
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'historial_limpiado',
        descripcion: `Limpió el historial de actividad (${rows.length} eventos borrados)`,
      });
      return res.status(200).json({ ok: true, eliminados: rows.length });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al limpiar la bitácora' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
