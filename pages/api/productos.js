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
      const { skuCodigo, nombre, unidadMedida, precioVenta, costoCompra, categoria, marca, sedes, stockPorSede } = req.body;
      if (!nombre || !unidadMedida || precioVenta === undefined || precioVenta === '') {
        return res.status(400).json({ error: 'Faltan datos del producto' });
      }
      const sedesElegidas = Array.isArray(sedes) ? sedes : [];
      if (sedesElegidas.length === 0) {
        return res.status(400).json({ error: 'Elige en qué tienda(s) aparece este producto' });
      }

      const { rows } = await query(
        `INSERT INTO productos (sku_codigo, nombre, unidad_medida, precio_venta, costo_compra, categoria, marca)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [skuCodigo || null, nombre, unidadMedida, precioVenta, costoCompra || null, categoria || null, marca || null]
      );
      const producto = rows[0];

      for (const sedeId of sedesElegidas) {
        const cfg = (stockPorSede && stockPorSede[sedeId]) || {};
        const stock = Number(cfg.stock) || 0;
        const minimo = Number(cfg.minimo) || 0;
        await query(
          `INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo, activo)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (sede_id, producto_id) DO UPDATE SET
             activo = true, stock_actual = EXCLUDED.stock_actual, stock_minimo = EXCLUDED.stock_minimo`,
          [sedeId, producto.id, stock, minimo]
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
      const { id, skuCodigo, nombre, unidadMedida, precioVenta, costoCompra, categoria, marca, activo } = req.body;
      if (!id) return res.status(400).json({ error: 'Falta el id del producto' });
      const { rows } = await query(
        `UPDATE productos SET
           sku_codigo = COALESCE($2, sku_codigo),
           nombre = COALESCE($3, nombre),
           unidad_medida = COALESCE($4, unidad_medida),
           precio_venta = COALESCE($5, precio_venta),
           costo_compra = COALESCE($6, costo_compra),
           categoria = COALESCE($7, categoria),
           marca = COALESCE($8, marca),
           activo = COALESCE($9, activo)
         WHERE id = $1 RETURNING *`,
        [
          id,
          skuCodigo ?? null,
          nombre ?? null,
          unidadMedida ?? null,
          precioVenta ?? null,
          costoCompra ?? null,
          categoria ?? null,
          marca ?? null,
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
      const { id, permanente } = req.query;
      if (!id) return res.status(400).json({ error: 'Falta el id del producto' });
      const prodRes = await query('SELECT nombre FROM productos WHERE id=$1', [id]);
      const nombre = prodRes.rows[0]?.nombre || 'producto';

      if (permanente === '1') {
        const usoRes = await query(
          `SELECT
             (SELECT COUNT(*) FROM detalle_ventas WHERE producto_id=$1) AS ventas,
             (SELECT COUNT(*) FROM traspasos WHERE producto_id=$1) AS traspasos`,
          [id]
        );
        const { ventas, traspasos } = usoRes.rows[0];
        if (Number(ventas) > 0 || Number(traspasos) > 0) {
          return res.status(400).json({
            error: `No se puede borrar "${nombre}" porque ya tiene ventas o traspasos registrados. Usa "Dar de baja" en su lugar — así se conserva el historial.`,
          });
        }
        await query('DELETE FROM inventario_sedes WHERE producto_id=$1', [id]);
        await query('DELETE FROM productos WHERE id=$1', [id]);
        await logEvento({
          origen: 'Cristian (admin)',
          tipo: 'producto_borrado',
          descripcion: `Borró definitivamente "${nombre}"`,
        });
        return res.status(200).json({ ok: true, borrado: true });
      }

      // Baja lógica GLOBAL — quita el producto de TODAS las tiendas, pero
      // conserva su historial de ventas/traspasos.
      await query('UPDATE productos SET activo = false WHERE id = $1', [id]);
      await logEvento({
        origen: 'Cristian (admin)',
        tipo: 'producto_baja',
        descripcion: `Dio de baja "${nombre}" en TODAS las tiendas`,
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al eliminar el producto' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
