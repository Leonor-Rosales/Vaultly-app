const nodemailer = require('nodemailer');

if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.warn('Aviso: faltan MAIL_USER o MAIL_PASS en .env; no se podrán enviar correos');
}

// Gmail con "contraseña de aplicación" (no la contraseña normal de la cuenta)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

const escapar = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function enviarCorreoVerificacion({ para, nombre, enlace }) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM || `Vaultly <${process.env.MAIL_USER}>`,
    to: para,
    subject: 'Confirma tu cuenta de Vaultly',
    text:
      `Hola ${nombre},\n\n` +
      `Para activar tu cuenta de Vaultly abre este enlace (vence en 24 horas):\n${enlace}\n\n` +
      `Si no creaste esta cuenta, ignora este mensaje.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#4a2412">` +
      `<h2>Confirma tu cuenta de Vaultly</h2>` +
      `<p>Hola ${escapar(nombre)}, gracias por registrarte.</p>` +
      `<p><a href="${enlace}" style="display:inline-block;background:#cf7040;color:#fff;` +
      `padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Activar mi cuenta</a></p>` +
      `<p style="font-size:13px;color:#7a6a60">El enlace vence en 24 horas. ` +
      `Si no creaste esta cuenta, ignora este mensaje.</p></div>`,
  });
}

module.exports = { enviarCorreoVerificacion };
