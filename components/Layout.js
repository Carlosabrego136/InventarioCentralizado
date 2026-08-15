import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/', label: 'Resumen', icon: '◆' },
  { href: '/inventario', label: 'Inventario', icon: '▤' },
  { href: '/traspasos', label: 'Traspasos', icon: '⇄' },
  { href: '/pos', label: 'Punto de venta', icon: '⎘' },
  { href: '/alertas', label: 'Alertas', icon: '!' },
];

export default function Layout({ children }) {
  const router = useRouter();

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
        <div className="sidebar-foot">Bodega Central + 3 tiendas<br />conectadas en tiempo real.</div>
      </aside>

      <main className="main">{children}</main>

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
      </nav>
    </div>
  );
}
