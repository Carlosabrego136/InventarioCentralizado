import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

function estadoCaducidad(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const f = new Date(fecha + 'T00:00:00');
  const dias = Math.round((f - hoy) / 86400000);
  if (dias < 0) return { texto: 'CADUCADO', clase: 'low' };
  if (dias <= 15) return { texto: `CADUCA EN ${dias}D`, clase: 'low' };
  return null;
}

// Para buscar sin que importen mayúsculas ni acentos ("azúcar" = "AZUCAR").
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const redondea = (n) => Math.round(n * 1000) / 1000;

export default function Inventario() {
  const router = useRouter();
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState(null); // { texto, err }
  const buscadorRef = useRef(null);

  useEffect(() => {
    fetch('/api/sedes')
      .then((r) => r.json())
      .then((list) => {
        setSedes(list);
        const q = Number(router.query.sedeId);
        setSedeId(q || list[0]?.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.sedeId]);

  useEffect(() => {
    if (!sedeId) return;
    cargar();
    setPendientes({});
    setBusqueda('');
    setMensaje(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId]);

  function cargar() {
    setLoading(true);
    fetch(`/api/inventario?sedeId=${sedeId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }

  function editarCampo(productoId, campo, valor) {
    setPendientes((p) => ({
      ...p,
      [productoId]: { ...p[productoId], [campo]: valor },
    }));
  }

  // Un producto cuenta como "con cambios" solo si de verdad hay algo que guardar
  // (una entrada vacía o en 0 no es un cambio).
  function tieneCambios(c) {
    if (!c) return false;
    return (
      (c.stockActual !== undefined && num(c.stockActual) !== null) ||
      (c.stockMinimo !== undefined && num(c.stockMinimo) !== null) ||
      c.fechaCaducidad !== undefined ||
      (num(c.entrada) !== null && num(c.entrada) > 0)
    );
  }
  const idsConCambios = Object.keys(pendientes).filter((id) => tieneCambios(pendientes[id]));
  const hayPendientes = idsConCambios.length > 0;

  async function patch(body) {
    try {
      const res = await fetch(`/api/inventario?sedeId=${sedeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true };
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error || 'No se pudo guardar' };
    } catch {
      return { ok: false, error: 'Sin conexión' };
    }
  }

  async function guardarCambios() {
    if (guardando || !hayPendientes) return;
    setGuardando(true);
    setMensaje(null);
    const fallidos = {};
    let guardados = 0;
    let primerError = '';

    for (const id of idsConCambios) {
      const c = pendientes[id];
      const productoId = Number(id);
      let restante = { ...c };
      let fallo = false;

      // 1) Correcciones por conteo (stock, mínimo, caducidad): igual que siempre.
      const body = { productoId };
      if (c.stockActual !== undefined && num(c.stockActual) !== null) body.stockActual = num(c.stockActual);
      if (c.stockMinimo !== undefined && num(c.stockMinimo) !== null) body.stockMinimo = num(c.stockMinimo);
      if (c.fechaCaducidad !== undefined) body.fechaCaducidad = c.fechaCaducidad || null;
      if (Object.keys(body).length > 1) {
        const r = await patch(body);
        if (r.ok) {
          delete restante.stockActual; delete restante.stockMinimo; delete restante.fechaCaducidad;
        } else { fallo = true; primerError = primerError || r.error; }
      }

      // 2) Entrada de mercancía: se suma al stock (después de la corrección, si hubo).
      if (!fallo && num(c.entrada) !== null && num(c.entrada) > 0) {
        const r = await patch({ productoId, entrada: redondea(num(c.entrada)) });
        if (r.ok) delete restante.entrada;
        else { fallo = true; primerError = primerError || r.error; }
      }

      if (fallo) fallidos[id] = restante; else guardados++;
    }

    setPendientes(fallidos);
    setGuardando(false);
    cargar();
    const nFallidos = Object.keys(fallidos).length;
    if (nFallidos === 0) setMensaje({ texto: `Listo: se guardaron ${guardados} producto(s).`, err: false });
    else setMensaje({ texto: `Se guardaron ${guardados}, pero ${nFallidos} no se pudieron guardar (${primerError}). Siguen en pantalla para reintentar.`, err: true });
    setTimeout(enfocarBuscador, 80);
  }

  async function quitarDeTienda(productoId, nombre) {
    if (!confirm(`¿Quitar "${nombre}" de esta tienda? Sigue existiendo en las demás y en el catálogo general.`)) return;
    await fetch(`/api/inventario?sedeId=${sedeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId, disponible: false }),
    });
    cargar();
  }

  function enfocarBuscador() {
    const el = buscadorRef.current;
    if (el) { el.focus(); el.select(); }
  }
  function enfocarEntrada(i) {
    const el = document.querySelector(`[data-entrada="${i}"]`);
    if (el) { el.focus(); el.select(); return true; }
    return false;
  }

  // Ctrl+S (o Cmd+S) guarda los cambios, en lugar de "guardar página".
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        guardarCambios();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Filtro: todas las palabras deben aparecer en el nombre o en el código.
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const todos = data?.inventario || [];
  const visibles = palabras.length === 0
    ? todos
    : todos.filter((p) => {
        const texto = normalizar(p.nombre) + ' ' + normalizar(p.sku_codigo);
        return palabras.every((w) => texto.includes(w));
      });
  const hayCodigos = todos.some((p) => p.sku_codigo);

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Inventario por sede</h1>
        <p className="page-sub">El catálogo de cada tienda es independiente — esto es lo que YA tiene esta tienda</p>
      </header>

      <section className="panel">
        <div className="form-row">
          <div>
            <label>Sede</label>
            <select value={sedeId || ''} onChange={(e) => setSedeId(Number(e.target.value))}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="help-box">
          <strong>Para resurtir</strong>: busca el producto y escribe en <strong>Entrada (+)</strong> lo que acaba de llegar — se suma al stock cuando guardas. Ejemplo: hay 13.66 y llegan 20 → queda en 33.66.<br/>
          <strong>Stock</strong>: cuántas unidades hay AHORA MISMO. Úsalo solo para corregir después de un conteo físico.<br/>
          <strong>Mínimo</strong>: cuando el stock llegue a este número o menos, aparece en Alertas. Ponlo en 0 para que nunca avise.<br/>
          <strong>Caducidad</strong>: opcional — solo si ese lote de producto en esta tienda caduca. Déjalo vacío si no aplica. Avisa 15 días antes.<br/>
          Para agregar productos nuevos, ve a <strong>Productos</strong>. Para quitar uno solo de esta tienda, usa "Quitar".
        </div>

        {loading || !data ? (
          <p className="empty-state">Cargando…</p>
        ) : data.inventario.length === 0 ? (
          <p className="empty-state">Esta tienda todavía no tiene productos asignados. Ve a Productos para agregarle.</p>
        ) : (
          <>
            <div className="inv-buscador">
              <input
                ref={buscadorRef}
                autoFocus
                type="text"
                autoComplete="off"
                className="inv-buscador-input"
                placeholder="Buscar producto para resurtir o corregir…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); enfocarEntrada(0); }
                  else if (e.key === 'Escape') setBusqueda('');
                }}
              />
              <span className="inv-contador">
                {palabras.length === 0 ? `${todos.length} productos` : `${visibles.length} de ${todos.length}`}
              </span>
            </div>
            <div className="inv-atajos">
              <span><kbd>Enter</kbd> ir a la cantidad</span>
              <span><kbd>↑</kbd><kbd>↓</kbd> cambiar de producto</span>
              <span><kbd>Enter</kbd> en la cantidad: volver a buscar</span>
              <span><kbd>Ctrl</kbd>+<kbd>S</kbd> guardar</span>
            </div>

            {visibles.length === 0 ? (
              <p className="empty-state">Nada coincide con esa búsqueda.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    {hayCodigos && <th>SKU</th>}
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Stock</th>
                    <th>Entrada (+)</th>
                    <th>Quedará</th>
                    <th className="num">Mínimo</th>
                    <th>Caducidad</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p, i) => {
                    const pend = pendientes[p.producto_id] || {};
                    const stockVal = pend.stockActual !== undefined ? pend.stockActual : p.stock_actual;
                    const minimoVal = pend.stockMinimo !== undefined ? pend.stockMinimo : p.stock_minimo;
                    const entradaVal = pend.entrada !== undefined ? pend.entrada : '';
                    const caducidadVal = pend.fechaCaducidad !== undefined ? pend.fechaCaducidad : (p.fecha_caducidad ? p.fecha_caducidad.slice(0, 10) : '');
                    const entradaNum = num(entradaVal) > 0 ? num(entradaVal) : 0;
                    const stockBase = num(stockVal) !== null ? num(stockVal) : Number(p.stock_actual);
                    const quedara = redondea(stockBase + entradaNum);
                    const bajo = Number(minimoVal) > 0 && quedara <= Number(minimoVal);
                    const caduca = estadoCaducidad(caducidadVal);
                    return (
                      <tr key={p.producto_id} className={tieneCambios(pend) ? 'fila-editada' : ''}>
                        {hayCodigos && <td className="mono dim">{p.sku_codigo}</td>}
                        <td>{p.nombre}</td>
                        <td className="mono">{p.unidad_medida}</td>
                        <td>
                          <input
                            className="min-input"
                            type="number" min="0" step="any"
                            value={stockVal}
                            onChange={(e) => editarCampo(p.producto_id, 'stockActual', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="min-input entrada-input"
                            data-entrada={i}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="+0"
                            value={entradaVal}
                            onChange={(e) => {
                              if (/^\d*\.?\d{0,3}$/.test(e.target.value)) editarCampo(p.producto_id, 'entrada', e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') { e.preventDefault(); enfocarEntrada(i + 1); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); if (i === 0) enfocarBuscador(); else enfocarEntrada(i - 1); }
                              else if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); enfocarBuscador(); }
                            }}
                          />
                        </td>
                        <td className="mono quedara">
                          {entradaNum > 0 ? <strong>{quedara}</strong> : <span className="dim">—</span>}
                        </td>
                        <td className="num">
                          <input
                            className="min-input"
                            type="number" min="0" step="any"
                            value={minimoVal}
                            onChange={(e) => editarCampo(p.producto_id, 'stockMinimo', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={caducidadVal}
                            onChange={(e) => editarCampo(p.producto_id, 'fechaCaducidad', e.target.value)}
                            style={{ padding: '6px 8px', fontSize: 12.5 }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className={`badge ${bajo ? 'low' : 'ok'}`}>{bajo ? 'BAJO MÍNIMO' : 'OK'}</span>
                            {caduca && <span className="badge low">{caduca.texto}</span>}
                          </div>
                        </td>
                        <td>
                          <button className="btn small secondary" onClick={() => quitarDeTienda(p.producto_id, p.nombre)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="save-bar">
              <span className="dim" style={{ fontSize: 13.5 }}>
                {hayPendientes
                  ? `${idsConCambios.length} producto(s) con cambios sin guardar`
                  : 'Todo guardado'}
              </span>
              <button className="btn" disabled={!hayPendientes || guardando} onClick={guardarCambios}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
            {mensaje && <p className={`inline-msg ${mensaje.err ? 'err' : ''}`}>{mensaje.texto}</p>}
          </>
        )}
      </section>
    </div>
  );
}
