import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';
import { formatFechaHora } from '../lib/format';
import { CurvaGanancias, BarrasComparativo } from '../components/Charts';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function hace30diasISO() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

export default function Finanzas() {
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState(hace30diasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [gastos, setGastos] = useState([]);
  const [nuevoGasto, setNuevoGasto] = useState({ sedeId: '', concepto: '', categoria: '', monto: '', fecha: hoyISO() });
  const [msgGasto, setMsgGasto] = useState(null);

  useEffect(() => {
    fetch('/api/sedes').then((r) => r.json()).then(setSedes);
  }, []);

  function buscar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (sedeId) params.set('sedeId', sedeId);
    params.set('desde', desde);
    params.set('hasta', hasta);
    fetch(`/api/finanzas?${params.toString()}`).then((r) => r.json()).then((d) => {
      setData(d);
      setLoading(false);
    });
    fetch(`/api/gastos?${params.toString()}`).then((r) => r.json()).then(setGastos);
  }

  useEffect(() => { buscar(); }, []);

  async function crearGasto(e) {
    e.preventDefault();
    setMsgGasto(null);
    const res = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sedeId: nuevoGasto.sedeId || null,
        concepto: nuevoGasto.concepto,
        categoria: nuevoGasto.categoria || null,
        monto: parseFloat(nuevoGasto.monto),
        fecha: nuevoGasto.fecha,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setMsgGasto({ text: d.error || 'No se pudo registrar', err: true }); return; }
    setMsgGasto({ text: 'Gasto registrado.', err: false });
    setNuevoGasto({ sedeId: '', concepto: '', categoria: '', monto: '', fecha: hoyISO() });
    buscar();
  }

  async function borrarGasto(id) {
    if (!confirm('¿Borrar este gasto? No se puede deshacer.')) return;
    await fetch(`/api/gastos?id=${id}`, { method: 'DELETE' });
    buscar();
  }

  const t = data?.totales;

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Finanzas</h1>
        <p className="page-sub">Ingresos, costos, gastos y ganancia real — por tienda o de todo el negocio junto</p>
      </header>

      <section className="panel">
        <div className="form-row">
          <div>
            <label>Sede</label>
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Todas (negocio completo)</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              <option value="general">Solo gastos generales (sin tienda)</option>
            </select>
          </div>
          <div>
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button className="btn" onClick={buscar}>Calcular</button>
        </div>
        <div className="help-box">
          <strong>Ingresos</strong>: lo que entró por ventas en el rango elegido.<br/>
          <strong>Costo de venta</strong>: lo que TE costó lo que se vendió — se calcula con el "Costo de compra" que le pusiste a cada producto en Productos. Si no le pusiste costo a un producto, cuenta como $0 aquí (no está mal el cálculo, solo incompleto para ese producto).<br/>
          <strong>Gastos</strong>: lo que tú registres abajo (renta, nómina, luz, lo que sea — tú decides las categorías).<br/>
          <strong>Ganancia neta</strong> = Ingresos − Costo de venta − Gastos.
        </div>
      </section>

      {loading || !data ? (
        <p className="empty-state">Calculando…</p>
      ) : (
        <>
          <div className="grid-4">
            <div className="sede-card">
              <span className="sede-tag">Ingresos</span>
              <div className="sede-name" style={{ color: 'var(--sky, #38bdf8)' }}>${t.ingresos.toFixed(2)}</div>
            </div>
            <div className="sede-card">
              <span className="sede-tag">Costo de venta</span>
              <div className="sede-name" style={{ color: 'var(--text-muted)' }}>${t.costo.toFixed(2)}</div>
            </div>
            <div className="sede-card">
              <span className="sede-tag">Gastos</span>
              <div className="sede-name" style={{ color: 'var(--danger)' }}>${t.gastos.toFixed(2)}</div>
            </div>
            <div className="sede-card">
              <span className="sede-tag">Ganancia neta</span>
              <div className="sede-name" style={{ color: t.ganancia >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                ${t.ganancia.toFixed(2)}
              </div>
            </div>
          </div>

          <section className="panel">
            <h2 className="panel-title">Curva de ganancias — día por día</h2>
            <CurvaGanancias serie={data.serie} />
          </section>

          {!sedeId && (
            <section className="panel">
              <h2 className="panel-title">Comparativo por tienda (mismo rango)</h2>
              <BarrasComparativo datos={data.comparativo} />
              {data.gastosGenerales > 0 && (
                <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
                  + ${data.gastosGenerales.toFixed(2)} en gastos generales (no asignados a ninguna tienda en particular) — ya están restados en la "Ganancia neta" de arriba, pero no aparecen en ninguna barra individual.
                </p>
              )}
            </section>
          )}
        </>
      )}

      <section className="panel">
        <h2 className="panel-title">Registrar gasto</h2>
        <div className="help-box">
          Aquí llevas tus gastos como tú quieras — la categoría es libre (escribe lo que tenga sentido para ti: "Renta", "Nómina", "Proveedor", etc.). Si el gasto es de una tienda en específico, elígela; si es del negocio en general, déjalo en "General".
        </div>
        <form className="form-row" onSubmit={crearGasto}>
          <div>
            <label>Sede (opcional)</label>
            <select value={nuevoGasto.sedeId} onChange={(e) => setNuevoGasto({ ...nuevoGasto, sedeId: e.target.value })}>
              <option value="">General (todo el negocio)</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label>Concepto</label>
            <input required value={nuevoGasto.concepto} onChange={(e) => setNuevoGasto({ ...nuevoGasto, concepto: e.target.value })} placeholder="Renta de agosto" />
          </div>
          <div>
            <label>Categoría (libre)</label>
            <input value={nuevoGasto.categoria} onChange={(e) => setNuevoGasto({ ...nuevoGasto, categoria: e.target.value })} placeholder="Renta" />
          </div>
          <div>
            <label>Monto</label>
            <input required type="number" min="0" step="0.01" value={nuevoGasto.monto}
              onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" value={nuevoGasto.fecha} onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })} />
          </div>
          <button className="btn" type="submit">Registrar</button>
        </form>
        {msgGasto && <p className={`inline-msg ${msgGasto.err ? 'err' : ''}`}>{msgGasto.text}</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Gastos en este rango</h2>
        {gastos.length === 0 ? (
          <p className="empty-state">No hay gastos registrados en este rango todavía.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Sede</th><th className="num">Monto</th><th></th></tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id}>
                  <td className="mono dim">{new Date(g.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td>{g.concepto}</td>
                  <td>{g.categoria || '—'}</td>
                  <td>{g.sede_nombre || 'General'}</td>
                  <td className="num mono">${Number(g.monto).toFixed(2)}</td>
                  <td><button className="btn small secondary" onClick={() => borrarGasto(g.id)}>Borrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
