// Exportar a CSV, sin librerías nuevas — un archivo que Excel/Sheets
// abre directo, con acentos bien (con BOM al inicio).
export function descargarCSV(nombreArchivo, encabezados, filas) {
  const escapar = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [encabezados.map(escapar).join(','), ...filas.map((f) => f.map(escapar).join(','))];
  const csv = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
