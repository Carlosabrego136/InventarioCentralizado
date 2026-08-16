import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';
import { formatFechaHora } from '../lib/format';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

const TIPO_LABEL = {
  producto_creado: 'Producto creado',
  producto_editado: 'Producto editado',
  producto_baja: 'Producto dado de baja',
  stock_corregido: 'Stock corregido',
  minimo_editado: 'Mínimo editado',
  traspaso: 'Traspaso',
  historial_limpiado: 'Historial limpiado',
};

export default function Bitacora() {
  const [eventos, setEventos] = useState(null);

  function cargar() {
    fetch('/api/bitacora').then((r) => r.json()).then(setEventos);
  }

  useEffect(() => {
    cargar();
    // Actualiza sola cada 15s — así se ve "en tiempo real" sin recargar la página.
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Actividad</h1>
        <p className="page-sub">Todo lo que cambió, quién lo hizo y desde dónde — se actualiza sola</p>
      </header>

      <section className="panel">
        {!eventos ? (
          <p className="empty-state">Cargando…</p>
        ) : eventos.length === 0 ? (
          <p className="empty-state">Todavía no hay actividad registrada.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha y hora</th><th>Origen</th><th>Tipo</th><th>Qué pasó</th></tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="mono dim">{formatFechaHora(e.fecha)}</td>
                  <td>{e.origen}{e.sede_nombre ? ` · ${e.sede_nombre}` : ''}</td>
                  <td><span className="badge ok">{TIPO_LABEL[e.tipo] || e.tipo}</span></td>
                  <td>{e.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
