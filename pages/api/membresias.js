import { query } from '../../lib/db';
import { requireSession } from '../../lib/auth';

// Devuelve, para cada combinación producto+sede, si el producto está
// activo en esa tienda — para pintar los badges en la página Productos.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { rows } = await query('SELECT sede_id, producto_id, activo FROM inventario_sedes');
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar membresías' });
  }
}
