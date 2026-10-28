function crearRequiereAuth(verificarTokenSesion, buscarUsuario) {

  // Protege rutas: exige un header  Authorization: Bearer <token>
  async function requiereAuth(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.usuario = verificarTokenSesion(token);
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
    if (buscarUsuario) {
      try {
        const actual = await buscarUsuario(req.usuario.sub);
        if (!actual || actual.estado_cuenta !== 'ACTIVO') return res.status(401).json({ error: 'Tu cuenta no está activa' });
        req.usuario.rol = actual.rol;
      } catch { return res.status(503).json({ error: 'No se pudo verificar la sesión' }); }
    }
    next();
  }

  return requiereAuth;
}

// Restringe una ruta a ciertos roles, por ejemplo: requiereRol('ADMIN')
function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

module.exports = { crearRequiereAuth, requiereRol };
