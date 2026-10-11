function crearRequiereAuth(verificarTokenSesion) {

  // Protege rutas: exige un header  Authorization: Bearer <token>
  function requiereAuth(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.usuario = verificarTokenSesion(token);
      next();
    } catch {
      res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
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
