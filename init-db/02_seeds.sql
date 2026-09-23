BEGIN;

INSERT INTO roles (nombre, descripcion)
VALUES
    ('ADMIN', 'Administrador de la plataforma'),
    ('CLIENTE', 'Usuario del servicio de almacenamiento')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO planes (
    nombre,
    cuota_storage_gb,
    limite_descargas,
    precio_mensual,
    permite_carpetas_publicas,
    activo
)
VALUES
    ('Free',           5,   2,    0.00, FALSE, TRUE),
    ('Basic Open',    15,  10,   50.00, TRUE,  TRUE),
    ('Pro Developer', 50, NULL, 150.00, TRUE,  TRUE),
    ('Max Vault',    100, NULL, 200.00, TRUE,  TRUE)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO metodos_pago (nombre, descripcion)
VALUES
    ('Tarjeta de Crédito Simulada', 'Pago de prueba sin cobro real'),
    ('Transferencia Simulada', 'Transferencia de prueba sin movimiento real')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tipos_accion (codigo, descripcion)
VALUES
    ('REGISTER', 'Registro de usuario'),
    ('LOGIN_SUCCESS', 'Inicio de sesión exitoso'),
    ('LOGIN_FAIL', 'Intento de inicio de sesión fallido'),
    ('UPLOAD_FILE', 'Subida de archivo'),
    ('DOWNLOAD_FILE', 'Descarga de archivo'),
    ('DELETE_FILE', 'Eliminación de archivo'),
    ('MOVE_FILE', 'Movimiento de archivo'),
    ('CREATE_FOLDER', 'Creación de carpeta'),
    ('RENAME_FOLDER', 'Cambio de nombre de carpeta'),
    ('DELETE_FOLDER', 'Eliminación de carpeta'),
    ('CHANGE_VISIBILITY', 'Cambio de visibilidad'),
    ('SIMULATE_PAYMENT', 'Registro de pago simulado'),
    ('UPGRADE_PLAN', 'Cambio de plan'),
    ('RENEW_PLAN', 'Renovación de plan'),
    ('MODERATE_RESOURCE', 'Retiro de recurso del catálogo público')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;