const { crearRegistrarUsuario } = require('./registrarUsuario');
const { crearIniciarSesion } = require('./iniciarSesion');
const { crearObtenerPerfil } = require('./obtenerPerfil');
const { crearVerificarCorreo } = require('./verificarCorreo');
const { crearReenviarVerificacion } = require('./reenviarVerificacion');
const { crearSolicitarRecuperacion } = require('./solicitarRecuperacion');
const { crearRestablecerPassword } = require('./restablecerPassword');
const { crearEnviarVerificacion } = require('./enviarVerificacion');
const { crearEnviarCorreoRecuperacion } = require('./enviarCorreoRecuperacion');

/**
 * Puertos de autenticación, implementados por adaptadores en infrastructure:
 * repo: buscarRolPorNombre, crearUsuario, buscarPorCorreoConRol,
 * buscarPorIdConRol, activarSiPendiente, obtenerEstado, buscarPendientePorCorreo,
 * actualizarPassword(id, hash). Consultas/actualizaciones devuelven null si no hay
 * fila; activarSiPendiente devuelve boolean. Todos son asíncronos.
 * contrasenas: hashear(texto) y comparar(texto, hash), asíncronos.
 * tokens: crearTokenSesion(usuario), crearTokenVerificacion(id),
 * crearTokenRecuperacion(id) y verificarTokenVerificacion/Recuperacion(token).
 * Verificadores síncronos devuelven { sub } o lanzan si inválido/vencido.
 * correo: enviarCorreoVerificacion/Recuperacion({ para, nombre, enlace }),
 * asíncronos; rechazan si el transporte no acepta el envío.
 * frontendUrl/backendUrl: valores inyectados, no acceso a process.env aquí.
 */
function crearCasosAuth({ repo, contrasenas, tokens, correo, frontendUrl, backendUrl }) {
  const enviarVerificacion = crearEnviarVerificacion({
    crearTokenVerificacion: tokens.crearTokenVerificacion,
    enviarCorreoVerificacion: correo.enviarCorreoVerificacion,
    backendUrl,
  });
  const enviarCorreoRecuperacion = crearEnviarCorreoRecuperacion({
    enviarCorreo: correo.enviarCorreoRecuperacion, frontendUrl,
  });
  return {
    registrarUsuario: crearRegistrarUsuario({ repo, hashear: contrasenas.hashear, enviarVerificacion }),
    iniciarSesion: crearIniciarSesion({ repo, comparar: contrasenas.comparar, crearTokenSesion: tokens.crearTokenSesion }),
    obtenerPerfil: crearObtenerPerfil({ repo }),
    verificarCorreo: crearVerificarCorreo({ repo, verificarTokenVerificacion: tokens.verificarTokenVerificacion }),
    reenviarVerificacion: crearReenviarVerificacion({ repo, enviarVerificacion }),
    solicitarRecuperacion: crearSolicitarRecuperacion({ repo, crearTokenRecuperacion: tokens.crearTokenRecuperacion, enviarCorreoRecuperacion }),
    restablecerPassword: crearRestablecerPassword({ repo, hashear: contrasenas.hashear, verificarTokenRecuperacion: tokens.verificarTokenRecuperacion }),
  };
}

module.exports = { crearCasosAuth };
