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
  producto_borrado: 'Producto borrado para siempre',
  producto_asignado: 'Producto agregado a tienda',
  producto_quitado_tienda: 'Producto quitado de tienda',
  stock_corregido: 'Stock corregido',
  minimo_editado: 'Mínimo editado',
  caducidad_editada: 'Caducidad editada',
  gasto_registrado: 'Gasto registrado',
  gasto_borrado: 'Gasto borrado',
  caja_apertura: 'Caja abierta',
  caja_intermedio: 'Corte intermedio',
  caja_cierre: 'Caja cerrada',
  caja_retiro: 'Retiro de efectivo',
  caja_deposito: 'Depósito de efectivo',
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
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, []);

  async function limpiar() {
    if (!confirm(`Esto borra TODO el historial de actividad (${eventos?.length || 0} eventos visibles) de forma permanente. ¿Seguro?`)) return;
    const res = await fetch('/api/bitacora', { method: 'DELETE' });
    if (!res.ok) { alert('No se pudo limpiar'); return; }
    cargar();
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Actividad</h1>
        <p className="page-sub">Todo lo que cambió, quién lo hizo y desde qué tienda — se actualiza sola</p>
      </header>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn secondary small" onClick={limpiar}>Limpiar historial</button>
        </div>
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
              {eventos.map((e) => {
                const fh = formatFechaHora(e.fecha);
                return (
                  <tr key={e.id}>
                    <td className="fecha-cell">
                      <span className="dia">{fh.dia}</span>
                      <span className="fh">{fh.fecha} · {fh.hora}</span>
                    </td>
                    <td>{e.origen}{e.sede_nombre ? ` · ${e.sede_nombre}` : ''}</td>
                    <td><span className="badge ok">{TIPO_LABEL[e.tipo] || e.tipo}</span></td>
                    <td>{e.descripcion}</td>
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
