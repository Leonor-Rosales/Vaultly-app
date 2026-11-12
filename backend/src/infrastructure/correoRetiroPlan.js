const { escapar, plantillaCorreo } = require('./plantillaCorreo');

function crearCorreoRetiroPlan(enviar, frontendUrl) {
  const enlace = new URL('/planes#catalogo', frontendUrl).href;
  return async ({ id, para, nombre, plan, fechaFin }) => {
    const fecha = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'long', timeStyle: 'short' }).format(new Date(fechaFin));
    const resumen = `El plan ${plan} fue desactivado. Conservarás sus beneficios hasta el ${fecha} (Guatemala). Si sigue desactivado al vencer tu suscripción, pasarás a Free sin otro cobro, aunque tuvieras activada la renovación automática. Tus archivos se conservan; las subidas y descargas estarán sujetas a los límites de Free.`;
    const resultado = await enviar({ to: para, subject: 'Información importante sobre tu plan de Vaultly',
      messageId: `<retiro-plan-${id}@vaultly.invalid>`,
      text: `Hola ${nombre},\n\n${resumen}\n\nPuedes consultar los planes disponibles: ${enlace}\n\nConsulta el estado actual de tu plan en tu cuenta.`,
      html: plantillaCorreo({ nombre, titulo: 'Tu plan dejará de estar disponible',
        preencabezado: `Conservarás tu plan ${plan} hasta el ${fecha} (Guatemala).`,
        pie: 'Aviso automático sobre tu suscripción de Vaultly.',
        contenido: `<p style="font-size:15px;line-height:1.6;color:#786457">${escapar(resumen)}</p>
          <p style="padding:16px;background:#faf5ef;border:1px solid #e6d5c7;border-radius:12px;font-size:15px;line-height:1.6"><strong>Vencimiento:</strong><br>${escapar(fecha)} (Guatemala)</p>
          <p><a href="${escapar(enlace)}" style="display:inline-block;background:#ad4c22;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver planes disponibles</a></p>
          <p style="font-size:13px;line-height:1.6;color:#786457">Consulta el estado actual de tu plan en tu cuenta. Si el administrador lo reactiva antes del vencimiento, se aplicará tu preferencia de renovación.</p>` }) });
    if (resultado?.rejected?.length || (Array.isArray(resultado?.accepted) && !resultado.accepted.length)) throw new Error('El servidor de correo no aceptó el destinatario');
  };
}
module.exports = { crearCorreoRetiroPlan };
