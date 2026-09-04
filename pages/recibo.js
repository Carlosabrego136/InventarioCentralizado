import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

export default function Recibo() {
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState({}); // { [sedeId]: {direccion, telefono, mensaje} }
  const [guardando, setGuardando] = useState(null); // sedeId que se está guardando

  function cargar() {
    fetch('/api/sedes').then((r) => r.json()).then((s) => { setSedes(s); setLoading(false); });
  }

  useEffect(() => { cargar(); }, []);

  function editarCampo(sedeId, campo, valor) {
    setPendientes((p) => ({ ...p, [sedeId]: { ...p[sedeId], [campo]: valor } }));
  }

  async function guardar(sedeId) {
    const cambios = pendientes[sedeId];
    if (!cambios) return;
    setGuardando(sedeId);
    await fetch('/api/sedes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sedeId,
        reciboDireccion: cambios.direccion !== undefined ? cambios.direccion : undefined,
        reciboTelefono: cambios.telefono !== undefined ? cambios.telefono : undefined,
        reciboMensaje: cambios.mensaje !== undefined ? cambios.mensaje : undefined,
      }),
    });
    setPendientes((p) => { const n = { ...p }; delete n[sedeId]; return n; });
    setGuardando(null);
    cargar();
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Ticket de venta</h1>
        <p className="page-sub">Personaliza lo que sale impreso en el recibo de cada tienda</p>
      </header>

      <section className="panel">
        <div className="help-box">
          Todo esto es opcional — si dejas un campo vacío, el ticket de esa tienda usa el mensaje
          genérico de siempre ("¡Gracias por su compra!"). Los cambios se ven reflejados en el
          siguiente ticket que se imprima en esa tienda, al instante.
        </div>

        {loading ? (
          <p className="empty-state">Cargando…</p>
        ) : (
          sedes.filter((s) => s.tipo === 'tienda').map((s) => {
            const pend = pendientes[s.id] || {};
            const direccion = pend.direccion !== undefined ? pend.direccion : (s.recibo_direccion || '');
            const telefono = pend.telefono !== undefined ? pend.telefono : (s.recibo_telefono || '');
            const mensaje = pend.mensaje !== undefined ? pend.mensaje : (s.recibo_mensaje || '');
            const hayCambios = !!pendientes[s.id];
            return (
              <div key={s.id} style={{ marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
                <h2 className="panel-title" style={{ fontSize: 18, marginBottom: 12 }}>{s.nombre}</h2>
                <div className="form-row">
                  <div>
                    <label>Dirección (opcional)</label>
                    <input value={direccion} onChange={(e) => editarCampo(s.id, 'direccion', e.target.value)}
                      placeholder="Calle, número, colonia" style={{ minWidth: 240 }} />
                  </div>
                  <div>
                    <label>Teléfono (opcional)</label>
                    <input value={telefono} onChange={(e) => editarCampo(s.id, 'telefono', e.target.value)}
                      placeholder="55 1234 5678" />
                  </div>
                  <div>
                    <label>Mensaje de pie de ticket (opcional)</label>
                    <input value={mensaje} onChange={(e) => editarCampo(s.id, 'mensaje', e.target.value)}
                      placeholder="¡Gracias por su compra!" style={{ minWidth: 260 }} />
                  </div>
                  <button className="btn" disabled={!hayCambios || guardando === s.id} onClick={() => guardar(s.id)}>
                    {guardando === s.id ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
