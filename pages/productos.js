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
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', sedes: [] });
  const [msg, setMsg] = useState(null);
  const [pendientes, setPendientes] = useState({}); // { [id]: {nombre, unidadMedida, precioVenta} }
  const [guardando, setGuardando] = useState(false);

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
    setMsg({ text: `"${data.nombre}" creado. Ahora entra a Inventario en cada tienda para ponerle el stock inicial.`, err: false });
    setNuevo({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', sedes: [] });
    cargar();
  }

  function editarCampo(id, campo, valor) {
    setPendientes((p) => ({ ...p, [id]: { ...p[id], [campo]: valor } }));
  }

  const hayPendientes = Object.keys(pendientes).length > 0;

  async function guardarCambios() {
    setGuardando(true);
    for (const [id, cambios] of Object.entries(pendientes)) {
      const body = { id: Number(id) };
      if (cambios.nombre !== undefined) body.nombre = cambios.nombre;
      if (cambios.unidadMedida !== undefined) body.unidadMedida = cambios.unidadMedida;
      if (cambios.precioVenta !== undefined) body.precioVenta = parseFloat(cambios.precioVenta);
      await fetch('/api/productos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    setPendientes({});
    setGuardando(false);
    cargar();
  }

  async function reactivar(id) {
    await fetch('/api/productos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: true }),
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
        <div className="help-box">
          <strong>SKU</strong>: código interno opcional, solo para identificarlo (puedes dejarlo vacío).<br/>
          <strong>Precio</strong>: el precio de venta base — se puede ajustar puntualmente al cobrar sin cambiar este valor general.<br/>
          Después de crearlo, entra a <strong>Inventario</strong> en cada tienda elegida para ponerle el stock inicial (nace en 0).
        </div>
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
          <>
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Nombre</th><th>Unidad</th><th className="num">Precio</th>
                  <th>En qué tiendas</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => {
                  const pend = pendientes[p.id] || {};
                  return (
                    <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                      <td className="mono dim">{p.sku_codigo || '—'}</td>
                      <td>
                        <input
                          value={pend.nombre !== undefined ? pend.nombre : p.nombre}
                          onChange={(e) => editarCampo(p.id, 'nombre', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          value={pend.unidadMedida !== undefined ? pend.unidadMedida : p.unidad_medida}
                          onChange={(e) => editarCampo(p.id, 'unidadMedida', e.target.value)}
                        >
                          {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="num">
                        <input
                          className="min-input" type="number" min="0" step="0.01"
                          value={pend.precioVenta !== undefined ? pend.precioVenta : p.precio_venta}
                          onChange={(e) => editarCampo(p.id, 'precioVenta', e.target.value)}
                        />
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
                          <button className="btn small" onClick={() => reactivar(p.id)}>Reactivar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="save-bar">
              <span className="dim" style={{ fontSize: 13.5 }}>
                {hayPendientes ? 'Tienes cambios sin guardar' : 'Todo guardado'}
              </span>
              <button className="btn" disabled={!hayPendientes || guardando} onClick={guardarCambios}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
