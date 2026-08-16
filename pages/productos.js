import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const UNIDADES = ['kg', 'gr', 'lt', 'pza'];

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', disponibleReducido: true });
  const [msg, setMsg] = useState(null);

  function cargar() {
    fetch('/api/productos?includeInactive=1').then((r) => r.json()).then((data) => {
      setProductos(data);
      setLoading(false);
    });
  }

  useEffect(() => { cargar(); }, []);

  async function crear(e) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skuCodigo: nuevo.skuCodigo || null,
        nombre: nuevo.nombre,
        unidadMedida: nuevo.unidadMedida,
        precioVenta: parseFloat(nuevo.precioVenta),
        disponibleReducido: nuevo.disponibleReducido,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg({ text: data.error || 'No se pudo crear', err: true }); return; }
    setMsg({ text: `"${data.nombre}" creado.`, err: false });
    setNuevo({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', disponibleReducido: true });
    cargar();
  }

  async function actualizar(id, campo, valor) {
    await fetch('/api/productos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [campo]: valor }),
    });
    cargar();
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Dar de baja "${nombre}"? Ya no aparecerá en ninguna tienda, pero su historial de ventas se conserva.`)) return;
    await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  async function reactivar(id) {
    await actualizar(id, 'activo', true);
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Productos</h1>
        <p className="page-sub">Crea, edita precios/unidades o da de baja productos — se aplica en las 3 tiendas al instante</p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Nuevo producto</h2>
        <form className="form-row" onSubmit={crear}>
          <div>
            <label>SKU (opcional)</label>
            <input value={nuevo.skuCodigo} onChange={(e) => setNuevo({ ...nuevo, skuCodigo: e.target.value })} placeholder="CHI-004" />
          </div>
          <div>
            <label>Nombre</label>
            <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre del producto" />
          </div>
          <div>
            <label>Unidad</label>
            <select value={nuevo.unidadMedida} onChange={(e) => setNuevo({ ...nuevo, unidadMedida: e.target.value })}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label>Precio</label>
            <input required type="number" min="0" step="0.01" value={nuevo.precioVenta}
              onChange={(e) => setNuevo({ ...nuevo, precioVenta: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label>Tienda 3 (reducido)</label>
            <select value={nuevo.disponibleReducido ? '1' : '0'}
              onChange={(e) => setNuevo({ ...nuevo, disponibleReducido: e.target.value === '1' })}>
              <option value="1">Sí aparece</option>
              <option value="0">No aparece</option>
            </select>
          </div>
          <button className="btn" type="submit">Crear producto</button>
        </form>
        {msg && <p className={`inline-msg ${msg.err ? 'err' : ''}`}>{msg.text}</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Catálogo completo</h2>
        {loading ? <p className="empty-state">Cargando…</p> : (
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Nombre</th><th>Unidad</th><th className="num">Precio</th>
                <th>Tienda 3</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                  <td className="mono dim">{p.sku_codigo || '—'}</td>
                  <td>
                    <input defaultValue={p.nombre} onBlur={(e) => e.target.value !== p.nombre && actualizar(p.id, 'nombre', e.target.value)} />
                  </td>
                  <td>
                    <select defaultValue={p.unidad_medida} onChange={(e) => actualizar(p.id, 'unidadMedida', e.target.value)}>
                      {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="num">
                    <input className="min-input" type="number" min="0" step="0.01" defaultValue={p.precio_venta}
                      onBlur={(e) => actualizar(p.id, 'precioVenta', parseFloat(e.target.value))} />
                  </td>
                  <td>
                    <select defaultValue={p.disponible_reducido ? '1' : '0'}
                      onChange={(e) => actualizar(p.id, 'disponibleReducido', e.target.value === '1')}>
                      <option value="1">Sí</option>
                      <option value="0">No</option>
                    </select>
                  </td>
                  <td><span className={`badge ${p.activo ? 'ok' : 'low'}`}>{p.activo ? 'ACTIVO' : 'DE BAJA'}</span></td>
                  <td>
                    {p.activo ? (
                      <button className="btn small secondary" onClick={() => eliminar(p.id, p.nombre)}>Dar de baja</button>
                    ) : (
                      <button className="btn small" onClick={() => reactivar(p.id)}>Reactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
