import type { DocumentoOffice } from './ContenidoOffice';

export async function leerOffice(datos: ArrayBuffer, formato: 'docx' | 'xlsx'): Promise<DocumentoOffice> {
  if (formato === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(datos);
    return { tipo: 'xlsx', libro };
  }
  const [{ default: mammoth }, { default: DOMPurify }] = await Promise.all([import('mammoth'), import('dompurify')]);
  const contenido = await mammoth.convertToHtml({ arrayBuffer: datos }, {
    includeEmbeddedStyleMap: false, externalFileAccess: false,
  });
  const html = DOMPurify.sanitize(contenido.value, {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 's', 'sup', 'sub', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'blockquote'],
    ALLOWED_ATTR: ['src', 'alt', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^data:image\/(png|jpeg|gif|webp);base64,/i,
  });
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const resumen = Array.from(dom.body.children).map(n => n.textContent).join('\n').slice(0, 600);
  return { tipo: 'docx', html, resumen };
}
