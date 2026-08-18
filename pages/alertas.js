import { useEffect, useState } from 'react';
import { formatFechaHora } from '../lib/format';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

export default function Alertas() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/alertas').then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="page-loading">Cargando…</p>;

  const stock = data.stock || [];
  const caducidad = data.caducidad || [];

  const stockPorSede = {};
  stock.forEach((a) => {
    if (!stockPorSede[a.sede_id]) stockPorSede[a.sede_id] = { nombre: a.sede_nombre, items: [] };
    stockPorSede[a.sede_id].items.push(a);
  });

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Alertas</h1>
        <p className="page-sub">Stock mínimo y productos por caducar, en tiempo real</p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Stock mínimo</h2>
        {stock.length === 0 ? (
          <p className="empty-state">No hay productos por debajo de su mínimo en ninguna sede. ✓</p>
        ) : (
          Object.values(stockPorSede).map((grupo) => (
            <div key={grupo.nombre} style={{ marginBottom: 18 }}>
              <div className="dim" style={{ fontSize: 12.5, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {grupo.nombre} ({grupo.items.length})
              </div>
              {grupo.items.map((a) => (
                <div className="alert-row" key={a.producto_id}>
                  <div>
                    <div className="t1">{a.producto_nombre}</div>
                    <div className="t2">
                      {a.stock_actual} {a.unidad_medida} disponibles · mínimo {a.stock_minimo} {a.unidad_medida}
                    </div>
                    {a.alerta_desde && (() => { const fh = formatFechaHora(a.alerta_desde); return (
                      <div className="t2" style={{ marginTop: 4 }}>
                        Bajo mínimo desde: <span className="dia" style={{ display: 'inline' }}>{fh.dia}</span> {fh.fecha} · {fh.hora}
                      </div>
                    ); })()}
                  </div>
                  <span className="badge low">RESURTIR</span>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Caducidad</h2>
        {caducidad.length === 0 ? (
          <p className="empty-state">Nada caducado ni por caducar en los próximos 15 días. ✓</p>
        ) : (
          caducidad.map((a) => (
            <div className="alert-row" key={`${a.sede_id}-${a.producto_id}`}>
              <div>
                <div className="t1">{a.producto_nombre} <span className="dim" style={{ fontWeight: 400 }}>· {a.sede_nombre}</span></div>
                <div className="t2">
                  {a.ya_caduco ? 'Caducó el' : 'Caduca el'} {new Date(a.fecha_caducidad).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
              <span className="badge low">{a.ya_caduco ? 'CADUCADO' : 'PRÓXIMO A CADUCAR'}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
