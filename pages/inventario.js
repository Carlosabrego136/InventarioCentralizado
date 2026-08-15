import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function Inventario() {
  const router = useRouter();
  const [sedes, setSedes] = useState([]);
  const [sedeId, setSedeId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sedes')
      .then((r) => r.json())
      .then((list) => {
        setSedes(list);
        const q = Number(router.query.sedeId);
        setSedeId(q || list[0]?.id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.sedeId]);

  useEffect(() => {
    if (!sedeId) return;
    setLoading(true);
    fetch(`/api/inventario?sedeId=${sedeId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [sedeId]);

  async function actualizarMinimo(productoId, valor) {
    const n = parseFloat(valor);
    if (isNaN(n) || n < 0) return;
    await fetch(`/api/inventario?sedeId=${sedeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId, stockMinimo: n }),
    });
    fetch(`/api/inventario?sedeId=${sedeId}`)
      .then((r) => r.json())
      .then(setData);
  }

  return (
    <div>
      <header className="topbar">
        <h1 className="page-title">Inventario por sede</h1>
        <p className="page-sub">Consulta y ajusta el stock mínimo por producto</p>
      </header>

      <section className="panel">
        <div className="form-row">
          <div>
            <label>Sede</label>
            <select value={sedeId || ''} onChange={(e) => setSedeId(Number(e.target.value))}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data?.sede?.catalogo_reducido && (
          <p className="catalogo-note">◆ Catálogo reducido — solo se muestran los productos habilitados para esta tienda</p>
        )}

        {loading || !data ? (
          <p className="empty-state">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Stock</th>
                <th className="num">Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.inventario.map((p) => {
                const bajo = Number(p.stock_minimo) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo);
                return (
                  <tr key={p.producto_id}>
                    <td className="mono dim">{p.sku_codigo}</td>
                    <td>{p.nombre}</td>
                    <td className="mono">{p.unidad_medida}</td>
                    <td className="mono">
                      {p.stock_actual} {p.unidad_medida}
                    </td>
                    <td className="num">
                      <input
                        className="min-input"
                        type="number"
                        min="0"
                        step="any"
                        defaultValue={p.stock_minimo}
                        onBlur={(e) => actualizarMinimo(p.producto_id, e.target.value)}
                      />
                    </td>
                    <td>
                      <span className={`badge ${bajo ? 'low' : 'ok'}`}>{bajo ? 'BAJO MÍNIMO' : 'OK'}</span>
                    </td>
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
