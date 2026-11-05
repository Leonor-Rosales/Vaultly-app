import type { Workbook } from 'exceljs';
import { useState } from 'react';

export type DocumentoOffice = { tipo: 'docx'; html: string; resumen: string }
  | { tipo: 'xlsx'; libro: Workbook };

export function ContenidoOffice({ documento, miniatura = false }: { documento: DocumentoOffice; miniatura?: boolean }) {
  const [hoja, setHoja] = useState(0);
  if (documento.tipo === 'docx') {
    if (miniatura) return <span className="muestra-texto muestra-documento">{documento.resumen || 'Documento sin texto'}</span>;
    return <div className="office-documento">
      <p className="office-nota">Vista de lectura. La distribución puede variar respecto a Word.</p>
      <div className="office-pagina" dangerouslySetInnerHTML={{ __html: documento.html || '<p>Documento vacío</p>' }} />
    </div>;
  }
  const hojas = documento.libro.worksheets.filter(h => h.state === 'visible');
  const activa = hojas[hoja];
  if (!activa) return <span>Libro sin hojas visibles</span>;
  const filas = Math.min(activa.rowCount, miniatura ? 5 : 500);
  const columnas = Math.min(activa.columnCount, miniatura ? 3 : 60);
  const datos = Array.from({ length: filas }, (_, i) => Array.from({ length: columnas }, (_, j) => {
    const celda = activa.getCell(i + 1, j + 1);
    if (celda.value instanceof Date) return celda.value.toLocaleDateString('es-GT', { timeZone: 'UTC' });
    if (celda.formula && celda.result === undefined) return 'Resultado no guardado';
    return celda.text;
  }));
  if (miniatura) return <span className="muestra-tabla">{datos.length ? datos.map((fila, i) =>
    <span key={i}>{fila.map((c, j) => <span key={j}>{c.slice(0, 36)}</span>)}</span>) : 'Hoja vacía'}</span>;
  return <div className="office-libro">
    <label>Hoja <select aria-label="Hoja" value={hoja} onChange={e => setHoja(Number(e.target.value))}>
      {hojas.map((h, i) => <option key={h.id} value={i}>{h.name}</option>)}
    </select></label>
    <p className="office-nota">Vista de datos. Las fórmulas muestran el resultado guardado en el archivo.</p>
    {(activa.rowCount > filas || activa.columnCount > columnas) && <p>Vista parcial de hasta 500 filas y 60 columnas.</p>}
    {datos.length ? <div className="lectura-texto" tabIndex={0} aria-label={'Contenido de ' + activa.name}>
      <table><thead><tr><th aria-label="Fila" />{Array.from({ length: columnas }, (_, j) =>
        <th scope="col" key={j}>{activa.getColumn(j + 1).letter}</th>)}</tr></thead>
        <tbody>{datos.map((fila, i) => <tr key={i}><th scope="row">{i + 1}</th>
          {fila.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
    </div> : <p>Hoja vacía</p>}
  </div>;
}
