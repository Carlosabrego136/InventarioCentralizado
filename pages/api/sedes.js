import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { rows } = await query('SELECT * FROM sedes ORDER BY id');
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar sedes' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, reciboDireccion, reciboTelefono, reciboMensaje } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Falta el id de la sede' });

      const { rows } = await query(
        `UPDATE sedes SET
           recibo_direccion = COALESCE($2, recibo_direccion),
           recibo_telefono = COALESCE($3, recibo_telefono),
           recibo_mensaje = COALESCE($4, recibo_mensaje)
         WHERE id = $1 RETURNING *`,
        [id, reciboDireccion ?? null, reciboTelefono ?? null, reciboMensaje ?? null]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Sede no encontrada' });

      await logEvento({
        sedeId: id,
        origen: 'Cristian (admin)',
        tipo: 'ticket_editado',
        descripcion: `Actualizó los datos del ticket de "${rows[0].nombre}"`,
      });

      return res.status(200).json(rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar la sede' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
