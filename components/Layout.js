import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Resumen', icon: '◆' },
  { href: '/inventario', label: 'Inventario', icon: '▤' },
  { href: '/productos', label: 'Productos', icon: '✎' },
  { href: '/traspasos', label: 'Traspasos', icon: '⇄' },
  { href: '/caja', label: 'Caja', icon: '🧾' },
  { href: '/reportes', label: 'Reportes', icon: '▦' },
  { href: '/finanzas', label: 'Finanzas', icon: '$' },
  { href: '/bitacora', label: 'Actividad', icon: '◷' },
  { href: '/alertas', label: 'Alertas', icon: '!' },
  { href: '/usuarios', label: 'Usuarios', icon: '👤' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const [notif, setNotif] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (router.pathname === '/login') return;
    function cargar() {
      fetch('/api/alertas').then((r) => (r.ok ? r.json() : null)).then(setNotif).catch(() => {});
    }
    cargar();
    const t = setInterval(cargar, 20000);
    return () => clearInterval(t);
  }, [router.pathname]);

  if (router.pathname === '/login') return <>{children}</>;

  async function salir() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const totalNotif = (notif?.stock?.length || 0) + (notif?.caducidad?.length || 0);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">PALA<span>FOX</span></div>
        <div className="brand-sub">Control central · Inventario</div>
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${router.pathname === item.href ? 'active' : ''}`}
            >
              <span className="ic">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          Bodega Central + 3 tiendas<br />conectadas en tiempo real.
          <br /><br />
          <button className="logout-link" onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main">
        <div className="notif-bell-wrap">
          <button className="pos-nav-btn" onClick={() => setNotifOpen(!notifOpen)} style={{ position: 'relative' }}>
            <span className="ic">🔔</span>
            {totalNotif > 0 && <span className="badge-count">{totalNotif}</span>}
          </button>
          {notifOpen && (
            <div className="notif-panel">
              <div className="notif-panel-head">Notificaciones — todas las tiendas</div>
              {totalNotif === 0 ? (
                <p className="sub" style={{ padding: '14px 16px' }}>Todo tranquilo por aquí. ✓</p>
              ) : (
                <>
                  {notif.stock.map((a) => (
                    <div className="notif-item" key={`s-${a.sede_id}-${a.producto_id}`}>
                      <span className="notif-dot low" />
                      <div>
                        <div className="notif-title">{a.producto_nombre} · {a.sede_nombre}</div>
                        <div className="notif-sub">
                          {Number(a.stock_actual) <= 0 ? 'Se agotó' : `Quedan ${a.stock_actual} ${a.unidad_medida}`} — mínimo {a.stock_minimo} {a.unidad_medida}
                        </div>
                      </div>
                    </div>
                  ))}
                  {notif.caducidad.map((a) => (
                    <div className="notif-item" key={`c-${a.sede_id}-${a.producto_id}`}>
                      <span className="notif-dot warn" />
                      <div>
                        <div className="notif-title">{a.producto_nombre} · {a.sede_nombre}</div>
                        <div className="notif-sub">{a.ya_caduco ? 'Ya caducó' : 'Próximo a caducar'} — {new Date(a.fecha_caducidad).toLocaleDateString('es-MX')}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <Link href="/alertas" className="notif-panel-foot" onClick={() => setNotifOpen(false)}>Ver todas en Alertas</Link>
            </div>
          )}
        </div>
        {children}
      </main>

      <nav className="bottom-nav">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bn-item ${router.pathname === item.href ? 'active' : ''}`}
          >
            <span className="ic">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </Link>
        ))}
        <button className="bn-item" onClick={salir}>
          <span className="ic">⎋</span>
          <span className="bn-label">Salir</span>
        </button>
      </nav>
    </div>
  );
}
