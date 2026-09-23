BEGIN;

-- 1. Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(255)
);

-- 2. Usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    nombre_completo VARCHAR(150) NOT NULL,
    correo_electronico VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado_cuenta VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (estado_cuenta IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
    CHECK (btrim(nombre_completo) <> ''),
    CHECK (btrim(correo_electronico) <> '')
);

-- Evita registrar el mismo correo cambiando mayúsculas.
CREATE UNIQUE INDEX uq_usuarios_correo_normalizado
    ON usuarios (lower(btrim(correo_electronico)));

-- 3. Planes
CREATE TABLE planes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    cuota_storage_gb INT NOT NULL,
    limite_descargas INT,
    precio_mensual NUMERIC(10,2) NOT NULL,
    permite_carpetas_publicas BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CHECK (cuota_storage_gb > 0),
    CHECK (limite_descargas IS NULL OR limite_descargas >= 0),
    CHECK (precio_mensual >= 0)
);

-- limite_descargas = NULL significa descargas ilimitadas.

-- 4. Suscripciones
CREATE TABLE suscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    plan_id INT NOT NULL
        REFERENCES planes(id) ON DELETE RESTRICT,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    descargas_consumidas_ciclo INT NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    CHECK (fecha_fin > fecha_inicio),
    CHECK (descargas_consumidas_ciclo >= 0),
    CHECK (estado IN ('PENDIENTE', 'ACTIVA', 'VENCIDA', 'CANCELADA'))
);

-- Solo una suscripción marcada como ACTIVA por usuario.
CREATE UNIQUE INDEX uq_suscripcion_activa_usuario
    ON suscripciones (usuario_id)
    WHERE estado = 'ACTIVA';

-- 5. Métodos de pago
CREATE TABLE metodos_pago (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(255)
);

-- 6. Transacciones de pagos
CREATE TABLE transacciones_pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suscripcion_id UUID NOT NULL
        REFERENCES suscripciones(id) ON DELETE RESTRICT,
    metodo_pago_id INT NOT NULL
        REFERENCES metodos_pago(id) ON DELETE RESTRICT,
    monto NUMERIC(10,2) NOT NULL,
    fecha_transaccion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    numero_referencia_simulado VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    CHECK (monto >= 0),
    CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'FALLIDO'))
);

-- 7. Carpetas
CREATE TABLE carpetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    carpeta_padre_id UUID,
    nombre VARCHAR(100) NOT NULL,
    es_publica BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (id, usuario_id),

    -- La carpeta padre debe pertenecer al mismo usuario.
    FOREIGN KEY (carpeta_padre_id, usuario_id)
        REFERENCES carpetas(id, usuario_id)
        ON DELETE RESTRICT,

    CHECK (btrim(nombre) <> ''),
    CHECK (carpeta_padre_id IS NULL OR carpeta_padre_id <> id)
);

-- Evita nombres repetidos dentro de la misma carpeta,
-- incluyendo las carpetas que están en la raíz.
CREATE UNIQUE INDEX uq_carpetas_nombre_ubicacion
    ON carpetas (
        usuario_id,
        carpeta_padre_id,
        lower(btrim(nombre))
    )
    NULLS NOT DISTINCT;

-- 8. Archivos
CREATE TABLE archivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    carpeta_id UUID,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_objeto_minio VARCHAR(255) UNIQUE NOT NULL,
    ruta_minio VARCHAR(500) NOT NULL,
    tamanio_bytes BIGINT NOT NULL,
    tipo_mime VARCHAR(100) NOT NULL,
    es_publica BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- El archivo solo puede estar en una carpeta de su dueño.
    FOREIGN KEY (carpeta_id, usuario_id)
        REFERENCES carpetas(id, usuario_id)
        ON DELETE RESTRICT,

    CHECK (tamanio_bytes >= 0),
    CHECK (btrim(nombre_original) <> ''),
    CHECK (btrim(nombre_objeto_minio) <> '')
);

-- 9. Etiquetas
CREATE TABLE etiquetas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,

    CHECK (btrim(nombre) <> '')
);

-- 10. Relación entre archivos y etiquetas
CREATE TABLE archivo_etiquetas (
    archivo_id UUID NOT NULL
        REFERENCES archivos(id) ON DELETE CASCADE,
    etiqueta_id INT NOT NULL
        REFERENCES etiquetas(id) ON DELETE CASCADE,

    PRIMARY KEY (archivo_id, etiqueta_id)
);

-- 11. Tipos de acción
CREATE TABLE tipos_accion (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descripcion VARCHAR(255) NOT NULL
);

-- 12. Auditoría
CREATE TABLE auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_accion_id INT NOT NULL
        REFERENCES tipos_accion(id) ON DELETE RESTRICT,
    modulo_afectado VARCHAR(50) NOT NULL,
    ip_origen INET,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detalles_json JSONB
);

-- Índices para consultas frecuentes.
CREATE INDEX idx_archivos_usuario ON archivos(usuario_id);
CREATE INDEX idx_archivos_carpeta ON archivos(carpeta_id);
CREATE INDEX idx_archivos_publicos_nombre
    ON archivos(lower(nombre_original))
    WHERE es_publica = TRUE;

CREATE INDEX idx_carpetas_padre ON carpetas(carpeta_padre_id);
CREATE INDEX idx_suscripciones_usuario ON suscripciones(usuario_id);
CREATE INDEX idx_pagos_suscripcion ON transacciones_pagos(suscripcion_id);
CREATE INDEX idx_auditoria_usuario_fecha
    ON auditoria(usuario_id, fecha_hora DESC);

-- Actualiza updated_at cuando cambian los datos de un archivo.
CREATE FUNCTION actualizar_fecha_archivo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_archivos_updated_at
BEFORE UPDATE ON archivos
FOR EACH ROW
EXECUTE FUNCTION actualizar_fecha_archivo();

COMMIT;