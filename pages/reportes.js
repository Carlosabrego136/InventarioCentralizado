import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';
import { formatFechaHora } from '../lib/format';
import { descargarCSV } from '../lib/csv';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function hace7diasISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function Reportes() {
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState('');
  const [desde, setDesde] = useState(hace7diasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sedes').then((r) => r.json()).then(setSedes);
  }, []);

  function buscar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (sedeId) params.set('sedeId', sedeId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    fetch(`/api/reportes?${params.toString()}`).then((r) => r.json()).then((d) => {
      setData(d);
      setLoading(false);
    });
  }

  useEffect(() => { buscar(); }, []);

  const totalGeneral = (data?.totales || []).reduce((s, t) => s + Number(t.total), 0);

  async function limpiarHistorial() {
    if (!sedeId && !desde && !hasta) {
      alert('Elige al menos una tienda o un rango de fechas antes de limpiar.');
      return;
    }
    const cuantas = data?.totales?.reduce((s, t) => s + Number(t.num_ventas), 0) || 0;
    if (!confirm(`Esto va a borrar ${cuantas} venta(s) de forma permanente (las que ves ahorita con este filtro). No se puede deshacer. ¿Seguro?`)) return;
    const params = new URLSearchParams();
    if (sedeId) params.set('sedeId', sedeId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const res = await fetch(`/api/reportes?${params.toString()}`, { method: 'DELETE' });
    const data2 = await res.json();
    if (!res.ok) { alert(data2.error || 'No se pudo limpiar'); return; }
    buscar();
  }

  function exportarCSV() {
    const filas = (data?.detalle || []).map((d) => {
      const fh = formatFechaHora(d.fecha);
      return [`${fh.dia} ${fh.fecha} ${fh.hora}`, d.sede_nombre, d.producto_nombre, d.cantidad, d.unidad_medida || '', Number(d.subtotal).toFixed(2)];
    });
    descargarCSV(`reporte-ventas_${desde}_a_${hasta}.csv`,
      ['Fecha', 'Tienda', 'Producto', 'Cantidad', 'Unidad', 'Subtotal'], filas);
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Reportes de ventas</h1>
        <p className="page-sub">Qué se vendió, cuánto, a qué precio, en qué tienda y cuándo</p>
      </header>

      <section className="panel">
        <div className="form-row">
          <div>
            <label>Tienda</label>
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Todas</option>
              {sedes.filter((s) => s.tipo === 'tienda').map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
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
      </section>
      {loading ? <p className="empty-state">Cargando…</p> : (
        <>
          <div className="grid-4">
            {(data?.totales || []).map((t) => (
              <div className="sede-card" key={t.sede_id}>
                <span className="sede-tag">{t.sede_nombre}</span>
                <div className="sede-name">${Number(t.total).toFixed(2)}</div>
                <div className="sede-activity">{t.num_ventas} venta{t.num_ventas == 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>

          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h2 className="panel-title" style={{ margin: 0 }}>Total del periodo: ${totalGeneral.toFixed(2)}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary small" onClick={exportarCSV} disabled={(data?.detalle || []).length === 0}>Exportar CSV</button>
                <button className="btn secondary small" onClick={limpiarHistorial}>Limpiar historial (este filtro)</button>
              </div>
            </div>
            {(data?.detalle || []).length === 0 ? (
              <p className="empty-state">No hay ventas en ese rango.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th><th>Tienda</th><th>Producto</th>
                    <th className="num">Cantidad</th><th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detalle.map((d, idx) => (
                    <tr key={idx}>
                      <td className="fecha-cell">
                        {(() => { const fh = formatFechaHora(d.fecha); return (
                          <>
                            <span className="dia">{fh.dia}</span>
                            <span className="fh">{fh.fecha} · {fh.hora}</span>
                          </>
                        ); })()}
                      </td>
                      <td>{d.sede_nombre}</td>
                      <td>{d.producto_nombre}</td>
                      <td className="num mono">{d.cantidad} {d.unidad_medida || ''}</td>
                      <td className="num mono">${Number(d.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
