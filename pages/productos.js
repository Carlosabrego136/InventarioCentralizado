import { useEffect, useRef, useState } from 'react';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const UNIDADES = ['kg', 'gr', 'lt', 'pza'];

// Búsqueda sin importar acentos ni mayúsculas.
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Productos() {
  const [sedes, setSedes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', costoCompra: '', categoria: '', marca: '', precioMayoreo: '', cantidadMayoreo: '', sedes: [], stockPorSede: {} });
  const [msg, setMsg] = useState(null);
  const [pendientes, setPendientes] = useState({}); // { [id]: {nombre, unidadMedida, precioVenta} }
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const buscadorRef = useRef(null);

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

  function toggleNuevaSede(sede) {
    setNuevo((n) => {
      let sedesSel = n.sedes.includes(sede.id) ? n.sedes.filter((s) => s !== sede.id) : [...n.sedes, sede.id];
      // La Bodega Central surte a las tiendas — si eliges cualquier tienda,
      // la bodega entra automático (aunque con su propia cantidad aparte).
      const bodega = sedes.find((s) => s.tipo === 'bodega');
      const hayTiendaElegida = sedesSel.some((id) => sedes.find((s) => s.id === id)?.tipo === 'tienda');
      if (bodega && hayTiendaElegida && !sedesSel.includes(bodega.id)) sedesSel = [...sedesSel, bodega.id];
      return { ...n, sedes: sedesSel };
    });
  }

  function editarStockNuevo(sedeId, campo, valor) {
    setNuevo((n) => ({
      ...n,
      stockPorSede: { ...n.stockPorSede, [sedeId]: { ...n.stockPorSede[sedeId], [campo]: valor } },
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
        costoCompra: nuevo.costoCompra ? parseFloat(nuevo.costoCompra) : null,
        categoria: nuevo.categoria || null,
        marca: nuevo.marca || null,
        precioMayoreo: nuevo.precioMayoreo ? parseFloat(nuevo.precioMayoreo) : null,
        cantidadMayoreo: nuevo.cantidadMayoreo ? parseFloat(nuevo.cantidadMayoreo) : null,
        sedes: nuevo.sedes,
        stockPorSede: nuevo.stockPorSede,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg({ text: data.error || 'No se pudo crear', err: true }); return; }
    setMsg({ text: `"${data.nombre}" creado y disponible para vender de una vez.`, err: false });
    setNuevo({ skuCodigo: '', nombre: '', unidadMedida: 'kg', precioVenta: '', costoCompra: '', categoria: '', marca: '', precioMayoreo: '', cantidadMayoreo: '', sedes: [], stockPorSede: {} });
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
      if (cambios.costoCompra !== undefined) body.costoCompra = cambios.costoCompra === '' ? null : parseFloat(cambios.costoCompra);
      if (cambios.categoria !== undefined) body.categoria = cambios.categoria || null;
      if (cambios.marca !== undefined) body.marca = cambios.marca || null;
      if (cambios.precioMayoreo !== undefined) body.precioMayoreo = cambios.precioMayoreo === '' ? null : parseFloat(cambios.precioMayoreo);
      if (cambios.cantidadMayoreo !== undefined) body.cantidadMayoreo = cambios.cantidadMayoreo === '' ? null : parseFloat(cambios.cantidadMayoreo);
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
    if (!confirm(`¿Dar de baja "${nombre}" en TODAS las tiendas? Para quitarlo solo de una tienda, usa los botones de tienda en vez de este. (Esto conserva su historial de ventas — para borrarlo del todo usa "Borrar" a un lado.)`)) return;
    await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  async function borrarDefinitivo(id, nombre) {
    if (!confirm(`¿Borrar "${nombre}" PARA SIEMPRE? Esto no se puede deshacer. Si ya tiene ventas o traspasos registrados, no va a dejar — en ese caso usa "Baja total" en su lugar.`)) return;
    const res = await fetch(`/api/productos?id=${id}&permanente=1`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'No se pudo borrar'); return; }
    cargar();
  }

  // Filtro del catálogo: todas las palabras deben aparecer en el nombre, SKU,
  // categoría o marca. Se busca sobre lo ya guardado (no sobre lo que se está
  // escribiendo), así la fila no desaparece mientras se edita su nombre.
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const visibles = palabras.length === 0
    ? productos
    : productos.filter((p) => {
        const texto = [p.nombre, p.sku_codigo, p.categoria, p.marca].map(normalizar).join(' ');
        return palabras.every((w) => texto.includes(w));
      });
  const idsVisibles = new Set(visibles.map((p) => p.id));
  const idsPendientes = Object.keys(pendientes).map(Number);
  const pendientesOcultos = idsPendientes.filter((id) => !idsVisibles.has(id)).length;

  function enfocarBuscador() {
    const el = buscadorRef.current;
    if (el) { el.focus(); el.select(); }
  }
  function enfocarFila(i) {
    const el = document.querySelector(`[data-fila-nombre="${i}"]`);
    if (el) {
      el.focus();
      // El cursor queda al final del nombre (sin seleccionarlo), para que
      // escribir AGREGUE al nombre y nunca lo borre por accidente.
      const n = el.value.length;
      try { el.setSelectionRange(n, n); } catch (e) { /* nada */ }
    }
  }
  // Enter en nombre o precio: regresa al buscador para seguir con el siguiente.
  function enterVuelveABuscar(e) {
    if (e.key === 'Enter') { e.preventDefault(); enfocarBuscador(); }
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
          <strong>Precio</strong>: el precio de venta — el punto de venta siempre cobra este precio (o el de mayoreo, si aplica); el cajero ya no lo puede cambiar.<br/>
          <strong>Costo de compra</strong>: opcional — lo que TE cuesta a ti. Con esto el sistema calcula tu % de utilidad automático.<br/>
          <strong>Categoría / Marca</strong>: opcionales, solo para organizar y filtrar más fácil después.<br/>
          <strong>Precio mayoreo</strong>: opcional — si vendes 5kg o más (tú decides desde cuánto), se puede aplicar este precio especial en vez del normal, sin que el cajero tenga que hacer cuentas.<br/>
          <strong>Stock / Mínimo por tienda</strong>: cada tienda (y la Bodega) tiene su propia cantidad, totalmente aparte — la Bodega NO es una copia de lo que tienen las tiendas, es el almacén desde el que se les surte.<br/>
          Si eliges cualquier tienda, la Bodega se agrega sola — tú decides cuánto tiene la Bodega de ese producto.
        </div>
        <form onSubmit={crear}>
        <div className="form-row">
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
            <label>Precio de venta</label>
            <input required type="number" min="0" step="0.01" value={nuevo.precioVenta}
              onChange={(e) => setNuevo({ ...nuevo, precioVenta: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label>Costo de compra (opcional)</label>
            <input type="number" min="0" step="0.01" value={nuevo.costoCompra}
              onChange={(e) => setNuevo({ ...nuevo, costoCompra: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label>Categoría (opcional)</label>
            <input value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} placeholder="Especias" />
          </div>
          <div>
            <label>Marca (opcional)</label>
            <input value={nuevo.marca} onChange={(e) => setNuevo({ ...nuevo, marca: e.target.value })} placeholder="Genérica" />
          </div>
          <div>
            <label>Precio mayoreo (opcional)</label>
            <input type="number" min="0" step="0.01" value={nuevo.precioMayoreo}
              onChange={(e) => setNuevo({ ...nuevo, precioMayoreo: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label>Desde cuánto (mayoreo)</label>
            <input type="number" min="0" step="any" value={nuevo.cantidadMayoreo}
              onChange={(e) => setNuevo({ ...nuevo, cantidadMayoreo: e.target.value })} placeholder={`ej. 5 ${nuevo.unidadMedida}`} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label>¿En qué sede(s) aparece, y con cuánto stock?</label>
          <div className="sede-pill-row" style={{ paddingTop: 4, marginBottom: 12 }}>
            {sedes.map((s) => (
              <span key={s.id} className={`sede-pill ${nuevo.sedes.includes(s.id) ? 'on' : ''}`}
                onClick={() => toggleNuevaSede(s)}>
                {s.nombre.split('·')[0].trim()}
              </span>
            ))}
          </div>
          {nuevo.sedes.length > 0 && (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr><th>Sede</th><th className="num">Stock inicial</th><th className="num">Mínimo</th></tr>
              </thead>
              <tbody>
                {nuevo.sedes.map((sedeId) => {
                  const s = sedes.find((x) => x.id === sedeId);
                  const cfg = nuevo.stockPorSede[sedeId] || {};
                  return (
                    <tr key={sedeId}>
                      <td>{s?.nombre}{s?.tipo === 'bodega' ? ' (aparte de las tiendas)' : ''}</td>
                      <td className="num">
                        <input className="min-input" type="number" min="0" step="any"
                          value={cfg.stock ?? ''} placeholder="0"
                          onChange={(e) => editarStockNuevo(sedeId, 'stock', e.target.value)} />
                      </td>
                      <td className="num">
                        <input className="min-input" type="number" min="0" step="any"
                          value={cfg.minimo ?? ''} placeholder="0"
                          onChange={(e) => editarStockNuevo(sedeId, 'minimo', e.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button className="btn" type="submit">Crear producto</button>
        </div>
        </form>
        {msg && <p className={`inline-msg ${msg.err ? 'err' : ''}`}>{msg.text}</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Catálogo completo</h2>
        {loading ? <p className="empty-state">Cargando…</p> : (
          <>
            <div className="inv-buscador">
              <input
                ref={buscadorRef}
                type="text"
                autoComplete="off"
                className="inv-buscador-input"
                placeholder="Buscar producto por nombre, código, categoría o marca…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); enfocarFila(0); }
                  else if (e.key === 'Escape') setBusqueda('');
                }}
              />
              <span className="inv-contador">
                {palabras.length === 0 ? `${productos.length} productos` : `${visibles.length} de ${productos.length}`}
              </span>
            </div>
            <div className="inv-atajos">
              <span><kbd>Enter</kbd> ir al nombre del primero</span>
              <span><kbd>Enter</kbd> en nombre o precio: volver a buscar</span>
              <span><kbd>Esc</kbd> limpiar búsqueda</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Nombre</th><th>Unidad</th><th className="num">Precio</th>
                  <th className="num">Costo</th><th className="num">Utilidad</th>
                  <th className="num">Mayoreo</th>
                  <th>Categoría</th><th>Marca</th>
                  <th>En qué tiendas</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={12} className="empty-state">Ningún producto coincide con "{busqueda}".</td></tr>
                )}
                {visibles.map((p, idx) => {
                  const pend = pendientes[p.id] || {};
                  const precioVal = pend.precioVenta !== undefined ? pend.precioVenta : p.precio_venta;
                  const costoVal = pend.costoCompra !== undefined ? pend.costoCompra : (p.costo_compra ?? '');
                  const utilidad = costoVal && precioVal ? (((precioVal - costoVal) / precioVal) * 100).toFixed(1) : null;
                  return (
                    <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                      <td className="mono dim">{p.sku_codigo || '—'}</td>
                      <td>
                        <input
                          data-fila-nombre={idx}
                          value={pend.nombre !== undefined ? pend.nombre : p.nombre}
                          onChange={(e) => editarCampo(p.id, 'nombre', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); enfocarBuscador(); }
                            else if (e.key === 'ArrowDown') { e.preventDefault(); enfocarFila(idx + 1); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); if (idx === 0) enfocarBuscador(); else enfocarFila(idx - 1); }
                          }}
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
                          value={precioVal}
                          onChange={(e) => editarCampo(p.id, 'precioVenta', e.target.value)}
                          onKeyDown={enterVuelveABuscar}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="min-input" type="number" min="0" step="0.01"
                          value={costoVal}
                          placeholder="—"
                          onChange={(e) => editarCampo(p.id, 'costoCompra', e.target.value)}
                        />
                      </td>
                      <td className="num mono">{utilidad !== null ? `${utilidad}%` : '—'}</td>
                      <td className="num">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <input className="min-input" style={{ width: 60 }} type="number" min="0" step="0.01"
                            value={pend.precioMayoreo !== undefined ? pend.precioMayoreo : (p.precio_mayoreo ?? '')}
                            placeholder="$"
                            onChange={(e) => editarCampo(p.id, 'precioMayoreo', e.target.value)} />
                          <input className="min-input" style={{ width: 55 }} type="number" min="0" step="any"
                            value={pend.cantidadMayoreo !== undefined ? pend.cantidadMayoreo : (p.cantidad_mayoreo ?? '')}
                            placeholder="desde"
                            onChange={(e) => editarCampo(p.id, 'cantidadMayoreo', e.target.value)} />
                        </div>
                      </td>
                      <td>
                        <input
                          className="min-input" style={{ width: 100 }}
                          value={pend.categoria !== undefined ? pend.categoria : (p.categoria || '')}
                          placeholder="—"
                          onChange={(e) => editarCampo(p.id, 'categoria', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="min-input" style={{ width: 100 }}
                          value={pend.marca !== undefined ? pend.marca : (p.marca || '')}
                          placeholder="—"
                          onChange={(e) => editarCampo(p.id, 'marca', e.target.value)}
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn small secondary" onClick={() => eliminarGlobal(p.id, p.nombre)}>Baja total</button>
                            <button className="btn small secondary" onClick={() => borrarDefinitivo(p.id, p.nombre)}>Borrar</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn small" onClick={() => reactivar(p.id)}>Reactivar</button>
                            <button className="btn small secondary" onClick={() => borrarDefinitivo(p.id, p.nombre)}>Borrar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="save-bar">
              <span className="dim" style={{ fontSize: 13.5 }}>
                {hayPendientes
                  ? `${idsPendientes.length} producto(s) con cambios sin guardar${pendientesOcultos > 0 ? ` (${pendientesOcultos} fuera de la búsqueda actual; también se guardan)` : ''}`
                  : 'Todo guardado'}
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
