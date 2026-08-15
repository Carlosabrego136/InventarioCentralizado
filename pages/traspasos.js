import { useEffect, useState } from 'react';

export default function Traspasos() {
  const [sedes, setSedes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({ origenId: '', destinoId: '', productoId: '', cantidad: '' });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/sedes').then((r) => r.json()).then(setSedes);
    fetch('/api/productos').then((r) => r.json()).then(setProductos);
    cargarHistorial();
  }, []);

  function cargarHistorial() {
    fetch('/api/traspasos').then((r) => r.json()).then(setHistorial);
  }

  async function enviar(e) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/traspasos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origenId: Number(form.origenId),
        destinoId: Number(form.destinoId),
        productoId: Number(form.productoId),
        cantidad: parseFloat(form.cantidad),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo realizar el traspaso', err: true });
      return;
    }
    setMsg({ text: 'Traspaso realizado correctamente.', err: false });
    setForm({ ...form, cantidad: '' });
    cargarHistorial();
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Traspasos entre sedes</h1>
        <p className="page-sub">Mueve mercancía de bodega a tienda o entre tiendas</p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Nuevo traspaso</h2>
        <form className="form-row" onSubmit={enviar}>
          <div>
            <label>Origen</label>
            <select required value={form.origenId} onChange={(e) => setForm({ ...form, origenId: e.target.value })}>
              <option value="" disabled>Selecciona</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Destino</label>
            <select required value={form.destinoId} onChange={(e) => setForm({ ...form, destinoId: e.target.value })}>
              <option value="" disabled>Selecciona</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Producto</label>
            <select required value={form.productoId} onChange={(e) => setForm({ ...form, productoId: e.target.value })}>
              <option value="" disabled>Selecciona</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</option>
              ))}
            </select>
          </div>
          <div>
            <label>Cantidad</label>
            <input
              type="number" min="0" step="any" required placeholder="0"
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
            />
          </div>
          <button className="btn" type="submit">Realizar traspaso</button>
        </form>
        {msg && <p className={`inline-msg ${msg.err ? 'err' : ''}`}>{msg.text}</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Historial reciente</h2>
        {historial.length === 0 ? (
          <p className="empty-state">Aún no hay traspasos registrados.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Producto</th><th className="num">Cantidad</th><th>Movimiento</th></tr>
            </thead>
            <tbody>
              {historial.map((t) => (
                <tr key={t.id}>
                  <td className="mono dim">{new Date(t.fecha).toLocaleString('es-MX')}</td>
                  <td>{t.producto_nombre}</td>
                  <td className="num mono">{t.cantidad} {t.unidad_medida}</td>
                  <td className="mono">{t.origen_nombre} → {t.destino_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
