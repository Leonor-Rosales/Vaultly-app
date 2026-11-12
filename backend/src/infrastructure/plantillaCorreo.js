const escapar = valor => String(valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Marco compartido con el correo de cambio de dirección existente.
function plantillaCorreo({ preencabezado, titulo, nombre, contenido, pie }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#fcfaf8;color:#542818;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapar(preencabezado)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fcfaf8"><tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e6d5c7;border-radius:16px">
        <tr><td style="padding:28px 28px 22px;border-bottom:1px solid #eee2d8"><span style="font-size:26px;font-weight:bold;color:#ad4c22">Vaultly</span><p style="margin:6px 0 0;font-size:12px;color:#786457">TU CUENTA, SIEMPRE PROTEGIDA</p></td></tr>
        <tr><td style="padding:28px"><h1 style="margin:0 0 20px;font-size:25px;line-height:1.25;color:#542818">${escapar(titulo)}</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px">Hola ${escapar(nombre)},</p>
          ${contenido}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #eee2d8;font-size:12px;line-height:1.5;color:#786457">${escapar(pie)}</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}
module.exports = { escapar, plantillaCorreo };
