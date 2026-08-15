import { useEffect, useState } from 'react';

export default function Alertas() {
  const [alertas, setAlertas] = useState(null);

  useEffect(() => {
    fetch('/api/alertas').then((r) => r.json()).then(setAlertas);
  }, []);

  if (!alertas) return <p className="page-loading">Cargando…</p>;

  const bySede = {};
  alertas.forEach((a) => {
    if (!bySede[a.sede_id]) bySede[a.sede_id] = { nombre: a.sede_nombre, items: [] };
    bySede[a.sede_id].items.push(a);
  });

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Alertas de stock mínimo</h1>
        <p className="page-sub">Todo lo que necesita resurtido ahora mismo</p>
      </header>

      {alertas.length === 0 ? (
        <section className="panel">
          <p className="empty-state">No hay productos por debajo de su mínimo en ninguna sede. ✓</p>
        </section>
      ) : (
        Object.values(bySede).map((grupo) => (
          <section className="panel" key={grupo.nombre}>
            <h2 className="panel-title">
              {grupo.nombre} <span className="dim">({grupo.items.length})</span>
            </h2>
            {grupo.items.map((a) => (
              <div className="alert-row" key={a.producto_id}>
                <div>
                  <div className="t1">{a.producto_nombre}</div>
                  <div className="t2">
                    {a.stock_actual} {a.unidad_medida} disponibles · mínimo {a.stock_minimo} {a.unidad_medida}
                  </div>
                </div>
                <span className="badge low">RESURTIR</span>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
