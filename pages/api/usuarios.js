import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';
import { hashPassword } from '../../lib/passwords';

// Cuentas del punto de venta (tiendas y trabajadores). Solo Cristian, ya
// logueado en el central, puede ver o tocar esto.
export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { rows } = await query(
        `SELECT u.id, u.usuario, u.nombre, u.rol, u.sede_id, u.activo, u.creado_en,
                s.nombre AS sede_nombre
         FROM usuarios u
         LEFT JOIN sedes s ON s.id = u.sede_id
         ORDER BY u.rol DESC, s.nombre NULLS FIRST, u.nombre`
      );
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar usuarios' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { usuario, password, nombre, rol, sedeId } = req.body || {};
      const user = String(usuario || '').toLowerCase().trim();

      if (!user || !password || !nombre || !rol) {
        return res.status(400).json({ error: 'Faltan datos' });
      }
      if (!/^[a-z0-9._-]+$/.test(user)) {
        return res.status(400).json({ error: 'El usuario solo puede tener letras, números, punto, guion o guion bajo' });
      }
      if (!['admin', 'tienda'].includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      if (rol === 'tienda' && !sedeId) {
        return res.status(400).json({ error: 'Elige a qué tienda pertenece' });
      }
      if (String(password).length < 4) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      }

      const passwordHash = hashPassword(String(password));
      const { rows } = await query(
        `INSERT INTO usuarios (usuario, password_hash, nombre, rol, sede_id)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, usuario, nombre, rol, sede_id, activo, creado_en`,
        [user, passwordHash, nombre, rol, rol === 'tienda' ? sedeId : null]
      );

      const sedeNombre = rol === 'tienda' ? (await query('SELECT nombre FROM sedes WHERE id=$1', [sedeId])).rows[0]?.nombre : null;
      await logEvento({
        sedeId: rol === 'tienda' ? sedeId : null,
        origen: 'Cristian (admin)',
        tipo: 'usuario_creado',
        descripcion: `Creó la cuenta "${user}" para ${nombre} — ${rol === 'admin' ? 'administrador' : `trabajador de ${sedeNombre}`}`,
      });

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      if (err.code === '23505') return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
      return res.status(500).json({ error: 'Error al crear el usuario' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, nombre, sedeId, activo, password } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Falta el id del usuario' });

      if (password !== undefined && password !== '') {
        if (String(password).length < 4) {
          return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
        }
        await query('UPDATE usuarios SET password_hash=$2 WHERE id=$1', [id, hashPassword(String(password))]);
      }

      const { rows } = await query(
        `UPDATE usuarios SET
           nombre = COALESCE($2, nombre),
           sede_id = CASE WHEN $3::boolean THEN $4 ELSE sede_id END,
           activo = COALESCE($5, activo)
         WHERE id = $1
         RETURNING id, usuario, nombre, rol, sede_id, activo, creado_en`,
        [id, nombre ?? null, sedeId !== undefined, sedeId ?? null, activo === undefined ? null : activo]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      const cambios = [];
      if (activo === false) cambios.push('desactivada');
      if (activo === true) cambios.push('reactivada');
      if (password) cambios.push('contraseña restablecida');
      if (nombre) cambios.push(`nombre → "${nombre}"`);

      await logEvento({
        sedeId: rows[0].sede_id,
        origen: 'Cristian (admin)',
        tipo: 'usuario_editado',
        descripcion: `Editó la cuenta "${rows[0].usuario}"${cambios.length ? ': ' + cambios.join(', ') : ''}`,
      });

      return res.status(200).json(rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
