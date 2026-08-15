import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [sedes, setSedes] = useState([]);
  const [resumen, setResumen] = useState({});
  const [alertas, setAlertas] = useState([]);
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
      setAlertas(Array.isArray(alertasRes) ? alertasRes.slice(0, 5) : []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="page-loading">Cargando inventario…</div>;

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
