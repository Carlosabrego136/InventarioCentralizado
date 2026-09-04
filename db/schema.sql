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

-- ============================================================
-- Migración: bitácora de actividad (para que Cristian vea en tiempo
-- real qué cambió, quién lo hizo y desde dónde)
-- ============================================================
CREATE TABLE IF NOT EXISTS bitacora (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id),
    origen VARCHAR(30) NOT NULL,   -- 'Cristian (admin)', 'Tienda 1', etc.
    tipo VARCHAR(40) NOT NULL,     -- producto_creado, producto_editado, producto_baja,
                                    -- stock_corregido, minimo_editado, traspaso, historial_limpiado
    descripcion TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Migración: catálogo por tienda (cada sede tiene sus propios
-- productos, no uno compartido) + fecha/hora de cuándo empezó
-- cada alerta de stock mínimo.
-- ============================================================
ALTER TABLE inventario_sedes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE inventario_sedes ADD COLUMN IF NOT EXISTS alerta_desde TIMESTAMP;

-- ============================================================
-- Migración: costo de compra (% utilidad), categoría, marca,
-- y fecha de caducidad por lote/tienda.
-- ============================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo_compra DECIMAL(10,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria VARCHAR(80);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca VARCHAR(80);
ALTER TABLE inventario_sedes ADD COLUMN IF NOT EXISTS fecha_caducidad DATE;

-- ============================================================
-- Migración: precio de mayoreo (a partir de cierta cantidad) y
-- ventas en espera (para pausar un ticket y retomarlo después).
-- ============================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_mayoreo DECIMAL(10,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cantidad_mayoreo DECIMAL(10,3);

CREATE TABLE IF NOT EXISTS ventas_en_espera (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id),
    nota VARCHAR(150),
    ticket JSONB NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Migración: Finanzas — gastos reales (Cristian define sus
-- propias categorías, libres, como él las quiera llevar).
-- ============================================================
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id), -- NULL = gasto general del negocio, no de una tienda
    concepto VARCHAR(150) NOT NULL,
    categoria VARCHAR(80),            -- libre: "Renta", "Nómina", "Luz", lo que Cristian quiera
    monto DECIMAL(10,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Migración: Caja — cortes (apertura/intermedio/cierre) con
-- detección de sobrante/faltante, movimientos de efectivo
-- (depósitos/retiros), y método de pago por venta.
-- ============================================================
CREATE TABLE IF NOT EXISTS cortes_caja (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id) NOT NULL,
    cajero VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('apertura','intermedio','cierre')),
    fondo_inicial DECIMAL(10,2),
    efectivo_contado DECIMAL(10,2),
    efectivo_esperado DECIMAL(10,2),
    diferencia DECIMAL(10,2),
    nota TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id SERIAL PRIMARY KEY,
    sede_id INT REFERENCES sedes(id) NOT NULL,
    cajero VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('deposito','retiro')),
    monto DECIMAL(10,2) NOT NULL,
    concepto VARCHAR(150),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo';

-- ============================================================
-- Migración: usuarios individuales del punto de venta. Antes cada
-- tienda compartía una sola cuenta (tienda1/tienda2/tienda3); ahora
-- Cristian puede crear una cuenta por trabajador desde "Usuarios" en
-- el central, y sigue pudiendo tener también las cuentas compartidas
-- de siempre (no se quitan, son un respaldo si no ha dado de alta a
-- alguien todavía).
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(40) NOT NULL UNIQUE,       -- login, en minúsculas
    password_hash VARCHAR(160) NOT NULL,
    nombre VARCHAR(100) NOT NULL,              -- nombre real del trabajador
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin','tienda')),
    sede_id INT REFERENCES sedes(id),          -- NULL si rol='admin'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Migración: nombres reales de las sedes (Cristian los mandó por
-- WhatsApp). Solo renombra si todavía tienen el nombre de ejemplo —
-- segura de correr varias veces, no revive nombres viejos si ya se
-- cambiaron a mano después.
-- ============================================================
UPDATE sedes SET nombre = 'Bodega Mórelos'    WHERE nombre = 'Bodega Central';
UPDATE sedes SET nombre = 'Zaragoza centro'   WHERE nombre = 'Tienda 1 · Centro';
UPDATE sedes SET nombre = 'San Miguel avenida' WHERE nombre = 'Tienda 2 · Norte';
UPDATE sedes SET nombre = 'San Miguel centro' WHERE nombre = 'Tienda 3 · Express';
