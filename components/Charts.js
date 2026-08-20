// Gráficas hechas a mano con SVG — sin librerías externas, para no
// arriesgar el npm install en equipos viejos. Colores fijos vía CSS vars.

function formatCorto(fecha) {
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

export function CurvaGanancias({ serie }) {
  if (!serie || serie.length === 0) return null;
  const W = 720, H = 260, padL = 55, padR = 20, padT = 20, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const todos = serie.flatMap((d) => [d.ingresos, d.gastos + d.costo, d.ganancia]);
  const maxVal = Math.max(...todos, 1);
  const minVal = Math.min(...todos, 0);
  const rango = maxVal - minVal || 1;

  const x = (i) => padL + (i / Math.max(serie.length - 1, 1)) * innerW;
  const y = (v) => padT + innerH - ((v - minVal) / rango) * innerH;

  function linea(campo) {
    return serie.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[campo]).toFixed(1)}`).join(' ');
  }

  const gridN = 4;
  const gridLines = Array.from({ length: gridN + 1 }, (_, i) => minVal + (rango / gridN) * i);

  // Mostrar máximo ~7 etiquetas en el eje X, para que no se amontonen
  const paso = Math.max(1, Math.ceil(serie.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {gridLines.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} fontSize="10.5" fill="var(--text-dim)" textAnchor="end" fontFamily="var(--font-mono)">
              ${Math.round(v).toLocaleString('es-MX')}
            </text>
          </g>
        ))}
        {serie.map((d, i) => (
          i % paso === 0 ? (
            <text key={i} x={x(i)} y={H - 10} fontSize="10" fill="var(--text-dim)" textAnchor="middle" fontFamily="var(--font-mono)">
              {formatCorto(d.dia)}
            </text>
          ) : null
        ))}
        <path d={linea('ingresos')} fill="none" stroke="var(--sky, #38bdf8)" strokeWidth="2.5" />
        <path d={`${linea('gastos')}`} fill="none" stroke="var(--danger)" strokeWidth="2" strokeDasharray="4 3" />
        <path d={linea('ganancia')} fill="none" stroke="var(--ok)" strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--sky, #38bdf8)', marginRight: 6, verticalAlign: 'middle' }} />Ingresos</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--danger)', marginRight: 6, verticalAlign: 'middle' }} />Gastos + costo</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--ok)', marginRight: 6, verticalAlign: 'middle' }} />Ganancia neta</span>
      </div>
    </div>
  );
}

export function BarrasComparativo({ datos }) {
  if (!datos || datos.length === 0) return null;
  const W = 720, H = 220, padL = 20, padR = 20, padT = 20, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.ganancia)), 1);
  const barW = innerW / datos.length * 0.55;
  const gap = innerW / datos.length;
  const cero = padT + innerH / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={padL} y1={cero} x2={W - padR} y2={cero} stroke="var(--border)" strokeWidth="1" />
      {datos.map((d, i) => {
        const cx = padL + gap * i + gap / 2;
        const alto = (Math.abs(d.ganancia) / maxAbs) * (innerH / 2 - 8);
        const esNegativo = d.ganancia < 0;
        const barY = esNegativo ? cero : cero - alto;
        return (
          <g key={d.sede_id}>
            <rect x={cx - barW / 2} y={barY} width={barW} height={Math.max(alto, 1)}
              fill={esNegativo ? 'var(--danger)' : 'var(--ok)'} rx="4" />
            <text x={cx} y={esNegativo ? barY + alto + 16 : barY - 8} fontSize="11.5" fontWeight="700"
              fill="var(--text)" textAnchor="middle" fontFamily="var(--font-mono)">
              ${Math.round(d.ganancia).toLocaleString('es-MX')}
            </text>
            <text x={cx} y={H - 12} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
              {d.sede_nombre.split('·')[0].trim()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
