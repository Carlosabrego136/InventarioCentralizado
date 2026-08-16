import { query, logEvento } from '../../lib/db';
import { requireSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { includeInactive } = req.query;
      const filtro = includeInactive === '1' ? '' : 'WHERE activo = true';
      const { rows } = await query(`SELECT * FROM productos ${filtro} ORDER BY id`);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al consultar productos' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { skuCodigo, nombre, unidadMedida, precioVenta, sedes } = req.body;
      if (!nombre || !unidadMedida || precioVenta === undefined || precioVenta === '') {
        return res.status(400).json({ error: 'Faltan datos del producto' });
      }
      const sedesElegidas = Array.isArray(sedes) ? sedes : [];
      if (sedesElegidas.length === 0) {
        return res.status(400).json({ error: 'Elige en qué tienda(s) aparece este producto' });
      }

      const { rows } = await query(
        `INSERT INTO productos (sku_codigo, nombre, unidad_medida, precio_venta)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [skuCodigo || null, nombre, unidadMedida, precioVenta]
      );
      const producto = rows[0];

      for (const sedeId of sedesElegidas) {
        await query(
          `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo, activo)
           VALUES ($1, $2, 0, 0, true)
           ON CONFLICT (sede_id, producto_id) DO UPDATE SET activo = true`,
          [sedeId, producto.id]
        );
      }

      const sedesRes = await query('SELECT id, nombre FROM sedes WHERE id = ANY($1::int[])', [sedesElegidas]);
      const nombresSedes = sedesRes.rows.map((s) => s.nombre).join(', ');
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'producto_creado',
        descripcion: `Creó "${nombre}" — $${precioVenta}/${unidadMedida} — en: ${nombresSedes}`,
      });

      return res.status(201).json(producto);
    } catch (err) {
      console.error(err);
      if (err.code === '23505') return res.status(400).json({ error: 'Ese SKU ya existe' });
      return res.status(500).json({ error: 'Error al crear el producto' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, skuCodigo, nombre, unidadMedida, precioVenta, activo } = req.body;
      if (!id) return res.status(400).json({ error: 'Falta el id del producto' });
      const { rows } = await query(
        `UPDATE productos SET
           sku_codigo = COALESCE($2, sku_codigo),
           nombre = COALESCE($3, nombre),
           unidad_medida = COALESCE($4, unidad_medida),
           precio_venta = COALESCE($5, precio_venta),
           activo = COALESCE($6, activo)
         WHERE id = $1 RETURNING *`,
        [
          id,
          skuCodigo ?? null,
          nombre ?? null,
          unidadMedida ?? null,
          precioVenta ?? null,
          activo === undefined ? null : activo,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      const cambios = [];
      if (precioVenta !== undefined && precioVenta !== null) cambios.push(`precio → $${precioVenta}`);
      if (unidadMedida) cambios.push(`unidad → ${unidadMedida}`);
      if (nombre) cambios.push(`nombre → "${nombre}"`);
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'producto_editado',
        descripcion: `Editó "${rows[0].nombre}"${cambios.length ? ': ' + cambios.join(', ') : ''}`,
      });
      return res.status(200).json(rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el producto' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id del producto' });
      // Baja lógica GLOBAL — quita el producto de TODAS las tiendas.
      // Para quitarlo solo de una tienda en particular, usa el toggle
      // por sede en vez de este botón.
      const prodRes = await query('SELECT nombre FROM productos WHERE id=$1', [id]);
      await query('UPDATE productos SET activo = false WHERE id = $1', [id]);
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'producto_baja',
        descripcion: `Dio de baja "${prodRes.rows[0]?.nombre || 'producto'}" en TODAS las tiendas`,
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al eliminar el producto' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
