const { ErrorApp } = require('../domain/errores');
const { POLITICA: p, validarSolicitud, resumenSolicitud } = require('../domain/cambioCorreo');
// Los fallos esperados se devuelven dentro de la transacción para conservar contadores.
const fallo = (mensaje, estado, codigo) => ({ error: new ErrorApp(mensaje, estado, codigo) });
const entregar = r => { if (r.error) throw r.error; return r; };
function crearCasosCambioCorreo({ repo, contrasenas, codigos, correo }) {
  return {
    estado: id => repo.conUsuario(id, async tx => ({ solicitud: resumenSolicitud(tx.solicitud, tx.ahora) })),
    async solicitar(id, datos) {
      const d = validarSolicitud(datos);
      const codigo = codigos.generar();
      const hash = await contrasenas.hashear(codigo);
      const reserva = entregar(await repo.conUsuario(id, async tx => {
        const s = tx.solicitud, ahora = tx.ahora;
        if (!s.ventana_password || ahora - new Date(s.ventana_password) >= p.ventanaPasswordMinutos * 60000) { s.ventana_password = ahora; s.fallos_password = 0; }
        if (s.fallos_password >= p.fallosPassword) return fallo('Demasiados intentos de contraseña. Espera 15 minutos.', 429, 'PASSWORD_LIMITE');
        if (!await contrasenas.comparar(d.password, tx.usuario.password_hash)) {
          s.fallos_password++; await tx.guardar(s);
          return fallo('La contraseña actual no es correcta', 400, 'PASSWORD_INVALIDA');
        }
        if (d.correo === tx.usuario.correo_electronico.trim().toLowerCase()) return fallo('El nuevo correo debe ser diferente del actual', 400, 'CORREO_IGUAL');
        if (s.reenviar_desde && ahora < new Date(s.reenviar_desde)) return fallo('Espera 60 segundos entre envíos', 429, 'REENVIO_ESPERA');
        if (!s.ventana_envios || ahora - new Date(s.ventana_envios) >= 3600000) { s.ventana_envios = ahora; s.envios = 0; }
        if (s.envios >= p.enviosHora) return fallo('Alcanzaste el límite de 5 envíos por hora. Inténtalo más tarde.', 429, 'ENVIOS_LIMITE');
        if (await tx.ocupado(d.correo)) return fallo('Ese correo ya está registrado', 409, 'CORREO_OCUPADO');
        Object.assign(s, { solicitud_id: codigos.id(), correo_anterior: tx.usuario.correo_electronico, correo_nuevo: d.correo,
          codigo_hash: hash, estado: 'ENVIANDO', vence_en: new Date(+ahora + p.minutos * 60000),
          reenviar_desde: new Date(+ahora + p.esperaSegundos * 1000), intentos: 0, envios: s.envios + 1, fallos_password: 0 });
        await tx.guardar(s);
        return { id: s.solicitud_id, nombre: tx.usuario.nombre_completo };
      }));
      // SMTP fuera de la transacción: no mantiene bloqueos durante una llamada de red.
      let enviado = true;
      try { await correo.enviarCodigo({ para: d.correo, nombre: reserva.nombre, codigo, minutos: p.minutos }); }
      catch { enviado = false; }
      const result = await repo.conUsuario(id, async tx => {
        const s = tx.solicitud;
        if (s.solicitud_id !== reserva.id || s.estado !== 'ENVIANDO') return fallo('La solicitud fue cancelada o reemplazada', 409, 'SOLICITUD_CAMBIADA');
        s.estado = enviado ? 'PENDIENTE' : 'FALLIDO';
        if (!enviado) s.codigo_hash = null;
        await tx.guardar(s);
        return enviado ? { solicitud: resumenSolicitud(s, tx.ahora), mensaje: 'Enviamos el código al nuevo correo.' }
          : fallo('No pudimos enviar el código. Tu correo actual no cambió. Espera un minuto y vuelve a intentarlo.', 503, 'ENVIO_FALLIDO');
      });
      return entregar(result);
    },
    async cancelar(id) {
      return repo.conUsuario(id, async tx => {
        Object.assign(tx.solicitud, { estado: 'CANCELADO', codigo_hash: null, correo_nuevo: null, correo_anterior: null });
        await tx.guardar(tx.solicitud);
        return { mensaje: 'Solicitud cancelada. Tu correo actual no cambió.' };
      });
    },
    async confirmar(id, datos) {
      if (!datos || typeof datos.codigo !== 'string' || !/^\d{6}$/.test(datos.codigo) || typeof datos.solicitud_id !== 'string') throw new ErrorApp('Introduce el código de 6 dígitos', 400, 'CODIGO_INVALIDO');
      const result = entregar(await repo.conUsuario(id, async tx => {
        const s = tx.solicitud;
        if (s.solicitud_id !== datos.solicitud_id || s.estado !== 'PENDIENTE' || !s.codigo_hash) return fallo('El código ya no está disponible. Solicita uno nuevo.', 409, 'CODIGO_NO_DISPONIBLE');
        if (new Date(s.vence_en) <= tx.ahora) return fallo('El código venció. Solicita uno nuevo.', 400, 'CODIGO_VENCIDO');
        if (tx.usuario.correo_electronico !== s.correo_anterior) return fallo('Tu correo cambió desde que se solicitó el código. Cancela y vuelve a empezar.', 409, 'SOLICITUD_CAMBIADA');
        if (!await contrasenas.comparar(datos.codigo, s.codigo_hash)) {
          s.intentos++;
          if (s.intentos >= p.intentos) { s.estado = 'BLOQUEADO'; s.codigo_hash = null; }
          await tx.guardar(s);
          return fallo(s.estado === 'BLOQUEADO' ? 'Alcanzaste el límite de intentos. Solicita otro código.' : 'El código no es correcto', 400, s.estado === 'BLOQUEADO' ? 'CODIGO_LIMITE' : 'CODIGO_INVALIDO');
        }
        if (await tx.ocupado(s.correo_nuevo)) return fallo('Ese correo ya está registrado. Cancela y elige otro.', 409, 'CORREO_OCUPADO');
        const usuario = await tx.cambiarCorreo(s.correo_nuevo);
        s.estado = 'CONSUMIDO'; s.codigo_hash = null;
        await tx.guardar(s);
        return { usuario: { ...usuario, rol: 'ADMIN' }, anterior: s.correo_anterior };
      }));
      let notificado = true;
      try { await correo.notificarCambio({ para: result.anterior, nombre: result.usuario.nombre_completo }); }
      catch { notificado = false; }
      return { usuario: result.usuario, notificado, mensaje: notificado ? 'Correo actualizado y aviso enviado a tu dirección anterior.' : 'Correo actualizado. No pudimos enviar el aviso a tu dirección anterior.' };
    },
  };
}
module.exports = { crearCasosCambioCorreo };
