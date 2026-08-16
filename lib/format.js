// Fecha + hora en 12h con AM/PM, consistente en todo el sistema.
export function formatFechaHora(fecha) {
  const d = new Date(fecha);
  const fechaTxt = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaTxt = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${fechaTxt} · ${horaTxt}`;
}
