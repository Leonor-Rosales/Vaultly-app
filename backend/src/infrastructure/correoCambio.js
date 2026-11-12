// Puerto de transporte inyectable: producción usa el mailer existente; las pruebas no usan SMTP.
const { escapar, plantillaCorreo } = require('./plantillaCorreo');

function codigoHtml({ nombre, codigo, minutos }) {
  return plantillaCorreo({ nombre, titulo: 'Verifica tu nuevo correo',
    preencabezado: `Confirma tu nuevo correo. El código vence en ${minutos} minutos.`,
    pie: 'Este es un mensaje automático de seguridad de Vaultly.',
    contenido: `<p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#786457">Introduce este código en Configuración de Vaultly para confirmar el cambio de tu dirección de correo.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;background:#faf5ef;border:1px solid #e6d5c7;border-radius:12px">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:1px;color:#786457">CÓDIGO DE VERIFICACIÓN</p>
            <p style="margin:0;font-family:Consolas,monospace;font-size:36px;letter-spacing:6px;font-weight:bold;color:#ad4c22">${escapar(codigo)}</p>
            <p style="margin:14px 0 0;font-size:13px;color:#786457">Válido por ${escapar(minutos)} minutos</p>
          </td></tr></table>
          <p style="font-size:14px;line-height:1.6;margin:24px 0 12px"><strong>No compartas este código.</strong> Tu correo actual seguirá activo hasta que confirmes el cambio.</p>
          <p style="font-size:13px;line-height:1.6;margin:0;color:#786457">Si no solicitaste este cambio, ignora este mensaje. No se actualizará tu correo sin la verificación.</p>` });
}
function crearCorreoCambio(enviar) {
  return {
    enviarCodigo: ({ para, nombre, codigo, minutos }) => enviar({ to: para, subject: 'Verifica tu nuevo correo de Vaultly',
      text: `Hola ${nombre},\n\nTu código es: ${codigo}\nVence en ${minutos} minutos. No lo compartas.\nSi no solicitaste este cambio, ignora este mensaje.`,
      html: codigoHtml({ nombre, codigo, minutos }) }),
    notificarCambio: ({ para, nombre }) => enviar({ to: para, subject: 'Tu correo de Vaultly cambió',
      text: `Hola ${nombre},\n\nSe confirmó un cambio de correo en tu cuenta de Vaultly.\nSi no reconoces esta acción, contacta al administrador de tu instalación.` }),
  };
}
module.exports = { crearCorreoCambio };
