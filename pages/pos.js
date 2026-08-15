import { useEffect, useState } from 'react';

export default function POS() {
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState(null);
  const [inv, setInv] = useState(null);
  const [ticket, setTicket] = useState([]);
  const [modalProd, setModalProd] = useState(null);
  const [qtyVal, setQtyVal] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch('/api/sedes')
      .then((r) => r.json())
      .then((list) => {
        const tiendas = list.filter((s) => s.tipo === 'tienda');
        setSedes(tiendas);
        setSedeId(tiendas[0]?.id);
      });
  }, []);

  useEffect(() => {
    if (!sedeId) return;
    fetch(`/api/inventario?sedeId=${sedeId}`).then((r) => r.json()).then(setInv);
    setTicket([]);
  }, [sedeId]);

  function showToast(text, err = false) {
    setToast({ text, err });
    setTimeout(() => setToast(null), 2800);
  }

  function abrirModal(p) {
    setModalProd(p);
    setQtyVal('');
  }

  function agregar() {
    const cant = parseFloat(qtyVal);
    if (!cant || cant <= 0) { showToast('Cantidad inválida', true); return; }
    const yaEnTicket = ticket.filter((t) => t.producto_id === modalProd.producto_id).reduce((a, t) => a + t.cantidad, 0);
    if (cant + yaEnTicket > Number(modalProd.stock_actual)) {
      showToast(`Solo hay ${modalProd.stock_actual} ${modalProd.unidad_medida} disponibles`, true);
      return;
    }
    setTicket([
      ...ticket,
      {
        producto_id: modalProd.producto_id,
        nombre: modalProd.nombre,
        unidad_medida: modalProd.unidad_medida,
        precio_venta: modalProd.precio_venta,
        cantidad: cant,
      },
    ]);
    setModalProd(null);
  }

  function quitar(idx) {
    setTicket(ticket.filter((_, i) => i !== idx));
  }

  const total = ticket.reduce((s, t) => s + Number(t.precio_venta) * t.cantidad, 0);

  async function cobrar() {
    const res = await fetch('/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sedeId,
        items: ticket.map((t) => ({ productoId: t.producto_id, cantidad: t.cantidad })),
      }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'No se pudo cobrar', true); return; }
    setTicket([]);
    fetch(`/api/inventario?sedeId=${sedeId}`).then((r) => r.json()).then(setInv);
    if (data.alertas?.length) {
      showToast(`Venta cobrada. ⚠ Bajo mínimo: ${data.alertas.join(', ')}`, true);
    } else {
      showToast(`Venta cobrada por $${Number(data.venta.total).toFixed(2)}`);
    }
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Punto de venta</h1>
        <p className="page-sub">Cobro rápido con alerta de stock mínimo</p>
      </header>

      <div className="form-row">
        <div>
          <label>Tienda</label>
          <select value={sedeId || ''} onChange={(e) => setSedeId(Number(e.target.value))}>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {inv?.sede?.catalogo_reducido && <p className="catalogo-note">◆ Catálogo reducido para esta tienda</p>}

      <div className="pos-layout">
        <div className="pos-grid">
          {inv?.inventario.map((p) => {
            const sinStock = Number(p.stock_actual) <= 0;
            const bajo = Number(p.stock_minimo) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo);
            return (
              <div
                key={p.producto_id}
                className={`pos-card ${sinStock ? 'disabled' : ''}`}
                onClick={() => !sinStock && abrirModal(p)}
              >
                <div className="sku">{p.sku_codigo}</div>
                <div className="nm">{p.nombre}</div>
                <div className="pr">${Number(p.precio_venta).toFixed(2)} / {p.unidad_medida}</div>
                <div className="st" style={{ color: bajo ? 'var(--danger)' : undefined }}>
                  {p.stock_actual} {p.unidad_medida} disp.{bajo ? ' ⚠' : ''}
                </div>
              </div>
            );
          })}
        </div>

        <div className="ticket">
          <h2 className="panel-title">Ticket</h2>
          {ticket.length === 0 ? (
            <p className="empty-ticket">Toca un producto para agregarlo</p>
          ) : (
            ticket.map((t, idx) => (
              <div className="ticket-item" key={idx}>
                <div>
                  <div className="n">{t.nombre}</div>
                  <div className="q">{t.cantidad} {t.unidad_medida} × ${Number(t.precio_venta).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="mono">${(t.cantidad * t.precio_venta).toFixed(2)}</span>
                  <button className="btn small secondary" onClick={() => quitar(idx)}>✕</button>
                </div>
              </div>
            ))
          )}
          <div className="ticket-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          <button className="btn full" disabled={ticket.length === 0} onClick={cobrar}>Cobrar</button>
        </div>
      </div>

      {modalProd && (
        <div className="qty-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setModalProd(null); }}>
          <div className="qty-modal">
            <h3>{modalProd.nombre}</h3>
            <p className="sub">
              {modalProd.stock_actual} {modalProd.unidad_medida} disponibles · ${Number(modalProd.precio_venta).toFixed(2)}/{modalProd.unidad_medida}
            </p>
            <input
              type="number" min="0" step="any" autoFocus
              placeholder={`Cantidad en ${modalProd.unidad_medida}`}
              value={qtyVal}
              onChange={(e) => setQtyVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
            />
            <div className="row">
              <button className="btn secondary" onClick={() => setModalProd(null)}>Cancelar</button>
              <button className="btn" onClick={agregar}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.err ? 'err' : ''}`}>{toast.text}</div>}
    </div>
  );
}
