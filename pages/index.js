import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

export default function Home() {
  const [sedes, setSedes] = useState([]);
  const [resumen, setResumen] = useState({});
  const [alertas, setAlertas] = useState([]);
  const [actividad, setActividad] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sedesRes = await fetch('/api/sedes').then((r) => r.json());
      setSedes(sedesRes);

      const byId = {};
      for (const s of sedesRes) {
        const inv = await fetch(`/api/inventario?sedeId=${s.id}`).then((r) => r.json());
        const list = inv.inventario || [];
        const bajos = list.filter(
          (p) => Number(p.stock_minimo) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo)
        );
        byId[s.id] = { total: list.length, bajos: bajos.length };
      }
      setResumen(byId);

      const alertasRes = await fetch('/api/alertas').then((r) => r.json());
      setAlertas(Array.isArray(alertasRes?.stock) ? alertasRes.stock.slice(0, 5) : []);

      const actividadRes = await fetch('/api/actividad').then((r) => r.json());
      const actById = {};
      (Array.isArray(actividadRes) ? actividadRes : []).forEach((a) => {
        actById[a.sede_id] = a.ultima_venta;
      });
      setActividad(actById);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="page-loading">Cargando inventario…</div>;

  function actividadTexto(sedeId) {
    const fecha = actividad[sedeId];
    if (!fecha) return 'Sin ventas registradas';
    const mins = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (mins < 1) return 'Última venta: justo ahora';
    if (mins < 60) return `Última venta: hace ${mins} min`;
    const horas = Math.round(mins / 60);
    if (horas < 24) return `Última venta: hace ${horas} h`;
    const dias = Math.round(horas / 24);
    return `Última venta: hace ${dias} d`;
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Resumen general</h1>
        <p className="page-sub">Estado del inventario en las 4 ubicaciones</p>
      </header>

      <div className="grid-4">
        {sedes.map((s) => (
          <Link key={s.id} href={`/inventario?sedeId=${s.id}`} className="sede-card">
            <span className={`sede-tag ${s.tipo === 'bodega' ? 'bodega' : ''}`}>
              {s.tipo === 'bodega' ? 'Bodega' : 'Tienda'}
              {s.catalogo_reducido ? ' · catálogo reducido' : ''}
            </span>
            <div className="sede-name">{s.nombre}</div>
            <div className="sede-stats">
              <div>
                <div className="sede-stat-num">{resumen[s.id]?.total ?? '—'}</div>
                <div className="sede-stat-label">Productos</div>
              </div>
              <div className={`sede-alert-pill ${(resumen[s.id]?.bajos ?? 0) === 0 ? 'ok' : ''}`}>
                {(resumen[s.id]?.bajos ?? 0) === 0 ? 'OK' : `${resumen[s.id].bajos} bajo mínimo`}
              </div>
            </div>
            {s.tipo === 'tienda' && <div className="sede-activity">{actividadTexto(s.id)}</div>}
          </Link>
        ))}
      </div>

      <section className="panel">
        <h2 className="panel-title">Prioridad de resurtido</h2>
        {alertas.length === 0 ? (
          <p className="empty-state">Todo el inventario está por encima de su mínimo. ✓</p>
        ) : (
          alertas.map((a) => (
            <div key={`${a.sede_id}-${a.producto_id}`} className="alert-row">
              <div>
                <div className="t1">
                  {a.producto_nombre} — {a.sede_nombre}
                </div>
                <div className="t2">
                  {a.stock_actual} {a.unidad_medida} disponibles · mínimo {a.stock_minimo} {a.unidad_medida}
                </div>
              </div>
              <span className="badge low">RESURTIR</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
