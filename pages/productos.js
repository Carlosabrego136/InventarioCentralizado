import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const UNIDADES = ['kg', 'gr', 'lt', 'pza'];

export default function Productos() {
  const [sedes, setSedes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [membresias, setMembresias] = useState([]); // [{sede_id, producto_id, activo}]
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', sedes: [] });
  const [msg, setMsg] = useState(null);

  function cargar() {
    Promise.all([
      fetch('/api/sedes').then((r) => r.json()),
      fetch('/api/productos?includeInactive=1').then((r) => r.json()),
      fetch('/api/membresias').then((r) => r.json()),
    ]).then(([s, p, m]) => {
      setSedes(s);
      setProductos(p);
      setMembresias(m);
      setLoading(false);
    });
  }

  useEffect(() => { cargar(); }, []);

  function tieneEnSede(productoId, sedeId) {
    const m = membresias.find((x) => x.producto_id === productoId && x.sede_id === sedeId);
    return !!m && m.activo;
  }

  async function toggleSede(productoId, sedeId, estabaActivo) {
    await fetch(`/api/inventario?sedeId=${sedeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId, disponible: !estabaActivo }),
    });
    cargar();
  }

  function toggleNuevaSede(sedeId) {
    setNuevo((n) => ({
      ...n,
      sedes: n.sedes.includes(sedeId) ? n.sedes.filter((s) => s !== sedeId) : [...n.sedes, sedeId],
    }));
  }

  async function crear(e) {
    e.preventDefault();
    setMsg(null);
    if (nuevo.sedes.length === 0) {
      setMsg({ text: 'Elige en qué tienda(s) va a aparecer.', err: true });
      return;
    }
    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skuCodigo: nuevo.skuCodigo || null,
        nombre: nuevo.nombre,
        unidadMedida: nuevo.unidadMedida,
        precioVenta: parseFloat(nuevo.precioVenta),
        sedes: nuevo.sedes,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg({ text: data.error || 'No se pudo crear', err: true }); return; }
    setMsg({ text: `"${data.nombre}" creado.`, err: false });
    setNuevo({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', sedes: [] });
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

  async function eliminarGlobal(id, nombre) {
    if (!confirm(`¿Dar de baja "${nombre}" en TODAS las tiendas? Para quitarlo solo de una tienda, usa los botones de tienda en vez de este.`)) return;
    await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Productos</h1>
        <p className="page-sub">Cada tienda tiene su propio catálogo — elige dónde aparece cada producto</p>
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
          <div style={{ minWidth: 260 }}>
            <label>¿En qué tienda(s) aparece?</label>
            <div className="sede-pill-row" style={{ paddingTop: 4 }}>
              {sedes.map((s) => (
                <span key={s.id} className={`sede-pill ${nuevo.sedes.includes(s.id) ? 'on' : ''}`}
                  onClick={() => toggleNuevaSede(s.id)}>
                  {s.nombre.split('·')[0].trim()}
                </span>
              ))}
            </div>
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
                <th>En qué tiendas</th><th>Estado</th><th></th>
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
                    <div className="sede-pill-row">
                      {sedes.map((s) => {
                        const activo = tieneEnSede(p.id, s.id);
                        return (
                          <span key={s.id} className={`sede-pill ${activo ? 'on' : ''}`}
                            onClick={() => toggleSede(p.id, s.id, activo)}>
                            {s.nombre.split('·')[0].trim()}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td><span className={`badge ${p.activo ? 'ok' : 'low'}`}>{p.activo ? 'ACTIVO' : 'DE BAJA'}</span></td>
                  <td>
                    {p.activo ? (
                      <button className="btn small secondary" onClick={() => eliminarGlobal(p.id, p.nombre)}>Baja total</button>
                    ) : (
                      <button className="btn small" onClick={() => actualizar(p.id, 'activo', true)}>Reactivar</button>
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
