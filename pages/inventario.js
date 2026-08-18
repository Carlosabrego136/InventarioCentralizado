import { useEffect, useState } from 'react';
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

export default function Inventario() {
  const router = useRouter();
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState({});
  const [guardando, setGuardando] = useState(false);

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

  const hayPendientes = Object.keys(pendientes).length > 0;

  async function guardarCambios() {
    setGuardando(true);
    for (const [productoId, cambios] of Object.entries(pendientes)) {
      const body = { productoId: Number(productoId) };
      if (cambios.stockActual !== undefined) body.stockActual = parseFloat(cambios.stockActual);
      if (cambios.stockMinimo !== undefined) body.stockMinimo = parseFloat(cambios.stockMinimo);
      if (cambios.fechaCaducidad !== undefined) body.fechaCaducidad = cambios.fechaCaducidad || null;
      await fetch(`/api/inventario?sedeId=${sedeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    setPendientes({});
    setGuardando(false);
    cargar();
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
          <strong>SKU</strong>: código interno del producto, solo para identificarlo rápido (opcional).<br/>
          <strong>Stock</strong>: cuántas unidades hay AHORA MISMO en esta tienda.<br/>
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
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th className="num">Mínimo</th>
                  <th>Caducidad</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.inventario.map((p) => {
                  const pend = pendientes[p.producto_id] || {};
                  const stockVal = pend.stockActual !== undefined ? pend.stockActual : p.stock_actual;
                  const minimoVal = pend.stockMinimo !== undefined ? pend.stockMinimo : p.stock_minimo;
                  const caducidadVal = pend.fechaCaducidad !== undefined ? pend.fechaCaducidad : (p.fecha_caducidad ? p.fecha_caducidad.slice(0, 10) : '');
                  const bajo = Number(minimoVal) > 0 && Number(stockVal) <= Number(minimoVal);
                  const caduca = estadoCaducidad(caducidadVal);
                  return (
                    <tr key={p.producto_id}>
                      <td className="mono dim">{p.sku_codigo}</td>
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
