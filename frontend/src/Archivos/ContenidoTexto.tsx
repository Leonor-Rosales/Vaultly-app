type Tabla = { filas: string[][]; limitada: boolean };

// Lee registros lógicos: un campo entrecomillado puede contener saltos de línea.
export function leerTabla(texto: string, formato: 'csv' | 'tsv'): Tabla {
  const cabecera = texto.split(/\r?\n/, 1)[0].replace(/"(?:[^"]|"")*"/g, '');
  const separador = formato === 'tsv' ? '\t' : cabecera.split(';').length > cabecera.split(',').length ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false, limitada = false;
  function agregarCampo() {
    if (fila.length < 60) fila.push(campo);
    else limitada = true;
    campo = '';
  }
  for (let i = 0; i < texto.length; i++) {
    if (filas.length >= 500) return { filas, limitada: true };
    const c = texto[i];
    if (c === '"' && (comillas || !campo)) {
      if (comillas && texto[i + 1] === '"') { campo += '"'; i++; }
      else comillas = !comillas;
    } else if (!comillas && c === separador) agregarCampo();
    else if (!comillas && (c === '\r' || c === '\n')) {
      agregarCampo();
      filas.push(fila);
      fila = [];
      if (c === '\r' && texto[i + 1] === '\n') i++;
    } else campo += c;
  }
  if (fila.length || (texto && !/[\r\n]$/.test(texto))) { agregarCampo(); filas.push(fila); }
  return { filas, limitada };
}

export function ContenidoTexto({ texto, tabla, miniatura = false }: { texto: string; tabla: Tabla | null; miniatura?: boolean }) {
  if (!texto) return <span>Archivo vacío</span>;
  if (miniatura) {
    if (!tabla) return <span className="muestra-texto">{texto.slice(0, 450)}</span>;
    return <span className="muestra-tabla">{tabla.filas.slice(0, 5).map((fila, i) =>
      <span key={i}>{fila.slice(0, 3).map((campo, j) => <span key={j}>{campo.slice(0, 36)}</span>)}</span>)}</span>;
  }
  return <div className="lectura-texto" tabIndex={0} aria-label="Contenido del archivo">
    {tabla ? <>
      {tabla.limitada && <p>Vista parcial de hasta 500 filas y 60 columnas.</p>}
      <table><thead><tr>{tabla.filas[0]?.map((c, j) => <th scope="col" key={j}>{c}</th>)}</tr></thead>
        <tbody>{tabla.filas.slice(1).map((fila, i) => <tr key={i}>{fila.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table></> : <pre>{texto}</pre>}
  </div>;
}
