import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export default function PaginaPdf({ pdf, pagina, ancho }: { pdf: PDFDocumentProxy; pagina: number; ancho: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let activo = true;
    let tarea: RenderTask | undefined;
    setFallo(false);
    async function dibujar() {
      const hoja = await pdf.getPage(pagina);
      if (!activo || !canvas.current) return;
      const base = hoja.getViewport({ scale: 1 });
      const viewport = hoja.getViewport({ scale: Math.min(ancho / base.width, ancho * 1.5 / base.height) });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      tarea = hoja.render({ canvas: canvas.current, viewport });
      await tarea.promise;
    }
    dibujar().catch(() => { if (activo) setFallo(true); });
    return () => { activo = false; tarea?.cancel(); };
  }, [pdf, pagina, ancho]);
  return fallo ? <span>Página no disponible</span> : <canvas ref={canvas} aria-label={`Página ${pagina}`} />;
}
