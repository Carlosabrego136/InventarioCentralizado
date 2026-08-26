import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';
import { formatFechaHora } from '../lib/format';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function hace7diasISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const TIPO_LABEL = { apertura: 'Apertura', intermedio: 'Corte intermedio', cierre: 'Cierre' };

export default function Caja() {
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState(hace7diasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [cortes, setCortes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sedes').then((r) => r.json()).then(setSedes);
  }, []);

  function buscar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (sedeId) params.set('sedeId', sedeId);
    params.set('desde', desde);
    params.set('hasta', hasta);
    Promise.all([
      fetch(`/api/caja?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/movimientos?${params.toString()}`).then((r) => r.json()),
    ]).then(([c, m]) => {
      setCortes(c);
      setMovimientos(m);
      setLoading(false);
    });
  }

  useEffect(() => { buscar(); }, []);

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Caja</h1>
        <p className="page-sub">Cortes de caja y movimientos de efectivo de todas las tiendas, en tiempo real</p>
      </header>

      <section className="panel">
        <div className="form-row">
          <div>
            <label>Tienda</label>
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Todas</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
          <button className="btn" onClick={buscar}>Buscar</button>
        </div>
        <div className="help-box">
          Los cortes se hacen desde el punto de venta de cada tienda — aquí solo los supervisas.
          <strong> Sobrante</strong> significa que había más efectivo del esperado; <strong>faltante</strong>, que había menos.
          El "esperado" se calcula con el fondo de apertura + ventas en efectivo + depósitos − retiros, desde que se abrió la caja.
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Historial de cortes</h2>
        {loading ? (
          <p className="empty-state">Cargando…</p>
        ) : cortes.length === 0 ? (
          <p className="empty-state">No hay cortes de caja en este rango.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Tienda</th><th>Cajero</th><th>Tipo</th>
                <th className="num">Fondo</th><th className="num">Contado</th><th className="num">Esperado</th>
                <th className="num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cortes.map((c) => {
                const fh = formatFechaHora(c.fecha);
                const diff = c.diferencia === null ? null : Number(c.diferencia);
                return (
                  <tr key={c.id}>
                    <td className="fecha-cell">
                      <span className="dia">{fh.dia}</span>
                      <span className="fh">{fh.fecha} · {fh.hora}</span>
                    </td>
                    <td>{c.sede_nombre}</td>
                    <td>{c.cajero}</td>
                    <td><span className="badge ok">{TIPO_LABEL[c.tipo] || c.tipo}</span></td>
                    <td className="num mono">{c.fondo_inicial !== null ? `$${Number(c.fondo_inicial).toFixed(2)}` : '—'}</td>
                    <td className="num mono">{c.efectivo_contado !== null ? `$${Number(c.efectivo_contado).toFixed(2)}` : '—'}</td>
                    <td className="num mono">{c.efectivo_esperado !== null ? `$${Number(c.efectivo_esperado).toFixed(2)}` : '—'}</td>
                    <td className="num mono">
                      {diff === null ? '—' : (
                        <span style={{ color: diff === 0 ? 'var(--ok)' : diff > 0 ? 'var(--amber)' : 'var(--danger)', fontWeight: 700 }}>
                          {diff === 0 ? 'Exacto' : `${diff > 0 ? '+' : ''}$${diff.toFixed(2)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Depósitos y retiros</h2>
        {loading ? (
          <p className="empty-state">Cargando…</p>
        ) : movimientos.length === 0 ? (
          <p className="empty-state">No hay movimientos de efectivo en este rango.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tienda</th><th>Cajero</th><th>Tipo</th><th>Concepto</th><th className="num">Monto</th></tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const fh = formatFechaHora(m.fecha);
                return (
                  <tr key={m.id}>
                    <td className="fecha-cell">
                      <span className="dia">{fh.dia}</span>
                      <span className="fh">{fh.fecha} · {fh.hora}</span>
                    </td>
                    <td>{m.sede_nombre}</td>
                    <td>{m.cajero}</td>
                    <td><span className={`badge ${m.tipo === 'retiro' ? 'low' : 'ok'}`}>{m.tipo === 'retiro' ? 'Retiro' : 'Depósito'}</span></td>
                    <td>{m.concepto || '—'}</td>
                    <td className="num mono">${Number(m.monto).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
