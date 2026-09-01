import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const session = getSession(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}

export default function Usuarios() {
  const [sedes, setSedes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ usuario: '', password: '', nombre: '', rol: 'tienda', sedeId: '' });
  const [msg, setMsg] = useState(null);
  const [resetPass, setResetPass] = useState({}); // { [id]: 'texto nueva contraseña' }

  function cargar() {
    Promise.all([
      fetch('/api/sedes').then((r) => r.json()),
      fetch('/api/usuarios').then((r) => r.json()),
    ]).then(([s, u]) => {
      setSedes(s.filter((x) => x.tipo === 'tienda'));
      setUsuarios(Array.isArray(u) ? u : []);
      setLoading(false);
    });
  }

  useEffect(() => { cargar(); }, []);

  async function crear(e) {
    e.preventDefault();
    setMsg(null);
    if (nuevo.rol === 'tienda' && !nuevo.sedeId) {
      setMsg({ text: 'Elige a qué tienda pertenece.', err: true });
      return;
    }
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: nuevo.usuario,
        password: nuevo.password,
        nombre: nuevo.nombre,
        rol: nuevo.rol,
        sedeId: nuevo.rol === 'tienda' ? Number(nuevo.sedeId) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg({ text: data.error || 'No se pudo crear', err: true }); return; }
    setMsg({ text: `Cuenta "${data.usuario}" creada para ${data.nombre}. Ya puede entrar al punto de venta con ese usuario y contraseña.`, err: false });
    setNuevo({ usuario: '', password: '', nombre: '', rol: 'tienda', sedeId: '' });
    cargar();
  }

  async function toggleActivo(u) {
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Reactivar'} la cuenta "${u.usuario}"?${u.activo ? ' Ya no va a poder entrar al punto de venta.' : ''}`)) return;
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, activo: !u.activo }),
    });
    cargar();
  }

  async function guardarNuevaPassword(id) {
    const nueva = resetPass[id];
    if (!nueva || nueva.length < 4) { alert('Escribe una contraseña de al menos 4 caracteres.'); return; }
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: nueva }),
    });
    setResetPass((r) => ({ ...r, [id]: '' }));
    alert('Contraseña actualizada.');
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Usuarios</h1>
        <p className="page-sub">Cuentas del punto de venta — una por trabajador, o una por tienda si prefieres compartirla</p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Nueva cuenta</h2>
        <div className="help-box">
          <strong>Usuario</strong>: lo que va a escribir para entrar al punto de venta (sin espacios, ej. "maria" o "juan.tienda2").<br/>
          <strong>Nombre</strong>: el nombre real de la persona — así vas a saber quién hizo cada corte de caja o cada movimiento, en vez de solo ver el nombre de la tienda.<br/>
          <strong>Tienda</strong>: a qué tienda va a entrar esta cuenta. Si es un administrador, no hace falta — puede elegir cualquier tienda al entrar.<br/>
          Las cuentas compartidas de siempre (tienda1, tienda2, tienda3) siguen funcionando igual, esto es nada más para poder tener cuentas separadas si las quieres.
        </div>
        <form className="form-row" onSubmit={crear}>
          <div>
            <label>Usuario</label>
            <input required value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} placeholder="ej. maria" />
          </div>
          <div>
            <label>Contraseña</label>
            <input required type="text" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} placeholder="mínimo 4 caracteres" />
          </div>
          <div>
            <label>Nombre real</label>
            <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="ej. María Pérez" />
          </div>
          <div>
            <label>Rol</label>
            <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value, sedeId: '' })}>
              <option value="tienda">Trabajador de tienda</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {nuevo.rol === 'tienda' && (
            <div>
              <label>Tienda</label>
              <select required value={nuevo.sedeId} onChange={(e) => setNuevo({ ...nuevo, sedeId: e.target.value })}>
                <option value="">Elige una tienda…</option>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
          <button className="btn" type="submit">Crear cuenta</button>
        </form>
        {msg && <p className={`inline-msg ${msg.err ? 'err' : ''}`}>{msg.text}</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Cuentas creadas</h2>
        {loading ? <p className="empty-state">Cargando…</p> : usuarios.length === 0 ? (
          <p className="empty-state">Todavía no has creado ninguna cuenta individual. Arriba puedes crear la primera.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuario</th><th>Nombre</th><th>Rol</th><th>Tienda</th><th>Estado</th>
                <th>Nueva contraseña</th><th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td className="mono">{u.usuario}</td>
                  <td>{u.nombre}</td>
                  <td>{u.rol === 'admin' ? 'Administrador' : 'Trabajador'}</td>
                  <td>{u.sede_nombre || (u.rol === 'admin' ? 'Cualquiera' : '—')}</td>
                  <td><span className={`badge ${u.activo ? 'ok' : 'low'}`}>{u.activo ? 'ACTIVA' : 'DESACTIVADA'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="min-input" style={{ width: 130 }} type="text" placeholder="dejar en blanco"
                        value={resetPass[u.id] || ''}
                        onChange={(e) => setResetPass((r) => ({ ...r, [u.id]: e.target.value }))}
                      />
                      <button className="btn small secondary" onClick={() => guardarNuevaPassword(u.id)} disabled={!resetPass[u.id]}>
                        Guardar
                      </button>
                    </div>
                  </td>
                  <td>
                    <button className="btn small secondary" onClick={() => toggleActivo(u)}>
                      {u.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
