-- ============================================================
-- Sistema de Inventario Palafox — esquema real (Aiven Postgres)
-- Todo vive dentro del schema "palafox" para no mezclarse con
-- otros proyectos que usen este mismo servicio de Aiven.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS palafox;

CREATE TABLE IF NOT EXISTS sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo VARCHAR(20) CHECK (tipo IN ('bodega', 'tienda')),
    catalogo_reducido BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    sku_codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    unidad_medida VARCHAR(20) CHECK (unidad_medida IN ('kg', 'gr', 'lt', 'pza')),
    precio_venta DECIMAL(10,2) NOT NULL,
    disponible_reducido BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS inventario_sedes (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id),
    producto_id INT REFERENCES productos(id),
    stock_actual DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    stock_minimo DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    CONSTRAINT uq_sede_producto UNIQUE (sede_id, producto_id)
);

CREATE TABLE IF NOT EXISTS traspasos (
    id SERIAL PRIMARY KEY,
    origen_id INT REFERENCES sedes(id),
    destino_id INT REFERENCES sedes(id),
    producto_id INT REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estatus VARCHAR(20) DEFAULT 'completado'
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS detalle_ventas (
    id SERIAL PRIMARY KEY,
    venta_id INT REFERENCES ventas(id),
    producto_id INT REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- Migración: control total de catálogo + venta libre + reportes
-- Segura de correr varias veces (IF NOT EXISTS en todo).
-- ============================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS nombre_libre VARCHAR(150);
ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS unidad_libre VARCHAR(20);
ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(10,2);
