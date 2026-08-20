import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { sedeId, desde, hasta } = req.query;
      const params = [];
      const cond = [];
      if (sedeId === 'general') {
        cond.push('g.sede_id IS NULL');
      } else if (sedeId) {
        params.push(sedeId);
        cond.push(`g.sede_id = $${params.length}`);
      }
      if (desde) { params.push(desde); cond.push(`g.fecha >= $${params.length}`); }
      if (hasta) { params.push(hasta); cond.push(`g.fecha <= $${params.length}`); }
      const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

      const { rows } = await query(
        `SELECT g.*, s.nombre AS sede_nombre
         FROM gastos g
         LEFT JOIN sedes s ON s.id = g.sede_id
         ${where}
         ORDER BY g.fecha DESC, g.id DESC
         LIMIT 300`,
        params
      );
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar gastos' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { sedeId, concepto, categoria, monto, fecha } = req.body;
      if (!concepto || monto === undefined || monto === '' || Number(monto) <= 0) {
        return res.status(400).json({ error: 'Falta el concepto o el monto' });
      }
      const { rows } = await query(
        `INSERT INTO gastos (sede_id, concepto, categoria, monto, fecha)
         VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE)) RETURNING *`,
        [sedeId || null, concepto, categoria || null, monto, fecha || null]
      );

      let nombreSede = 'General (todo el negocio)';
      if (sedeId) {
        const sedeRes = await query('SELECT nombre FROM sedes WHERE id=$1', [sedeId]);
        nombreSede = sedeRes.rows[0]?.nombre || nombreSede;
      }
      await logEvento({
        sedeId: sedeId || null,
        origen: 'Cristian (admin)',
        tipo: 'gasto_registrado',
        descripcion: `Registró gasto "${concepto}" — $${monto} (${nombreSede})`,
      });

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al registrar el gasto' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id' });
      const gastoRes = await query('SELECT concepto FROM gastos WHERE id=$1', [id]);
      await query('DELETE FROM gastos WHERE id=$1', [id]);
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'gasto_borrado',
        descripcion: `Borró el gasto "${gastoRes.rows[0]?.concepto || '—'}"`,
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al borrar el gasto' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
