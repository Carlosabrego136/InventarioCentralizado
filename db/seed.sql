-- Catálogo inicial de ejemplo — reemplázalo por el catálogo real de Cristian
-- editando este archivo (o cargándolo después desde un panel de importación).

INSERT INTO sedes (nombre, tipo, catalogo_reducido) VALUES
  ('Bodega Mórelos', 'bodega', FALSE),
  ('Zaragoza centro', 'tienda', FALSE),
  ('San Miguel avenida', 'tienda', FALSE),
  ('San Miguel centro', 'tienda', TRUE)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO productos (sku_codigo, nombre, unidad_medida, precio_venta, disponible_reducido) VALUES
  ('CHI-001', 'Chile Guajillo', 'kg', 180, TRUE),
  ('CHI-002', 'Chile Ancho', 'kg', 190, TRUE),
  ('CHI-003', 'Chile Pasilla', 'kg', 210, FALSE),
  ('ESP-001', 'Comino Molido', 'gr', 0.45, FALSE),
  ('ESP-002', 'Pimienta Negra', 'gr', 0.60, FALSE),
  ('ESP-003', 'Orégano Seco', 'gr', 0.35, TRUE),
  ('POL-001', 'Azúcar Estándar', 'kg', 22, TRUE),
  ('POL-002', 'Sal de Grano', 'kg', 14, TRUE),
  ('LIQ-001', 'Vinagre Blanco', 'lt', 28, FALSE),
  ('LIQ-002', 'Aceite Vegetal', 'lt', 32, TRUE),
  ('DES-001', 'Bolsa Kraft #2', 'pza', 1.2, FALSE),
  ('DES-002', 'Vaso Desechable 12oz', 'pza', 0.8, FALSE)
ON CONFLICT (sku_codigo) DO NOTHING;

-- Stock inicial por sede (algunos quedan a propósito por debajo del mínimo
-- para que veas las alertas funcionando desde el primer arranque)
INSERT INTO inventario_sedes (sede_id, producto_id, stock_actual, stock_minimo)
SELECT s.id, p.id, v.stock, v.minimo
FROM (VALUES
  ('Bodega Central','CHI-001',85,15), ('Bodega Central','CHI-002',62,15), ('Bodega Central','CHI-003',40,10),
  ('Bodega Central','ESP-001',9000,1500), ('Bodega Central','ESP-002',7200,1500), ('Bodega Central','ESP-003',5100,1000),
  ('Bodega Central','POL-001',180,40), ('Bodega Central','POL-002',140,40),
  ('Bodega Central','LIQ-001',95,20), ('Bodega Central','LIQ-002',110,20),
  ('Bodega Central','DES-001',3000,500), ('Bodega Central','DES-002',2400,500),

  ('Tienda 1 · Centro','CHI-001',18,10), ('Tienda 1 · Centro','CHI-002',6,8), ('Tienda 1 · Centro','CHI-003',22,8),
  ('Tienda 1 · Centro','ESP-001',1400,800), ('Tienda 1 · Centro','ESP-002',900,800), ('Tienda 1 · Centro','ESP-003',2200,600),
  ('Tienda 1 · Centro','POL-001',38,25), ('Tienda 1 · Centro','POL-002',41,25),
  ('Tienda 1 · Centro','LIQ-001',14,10), ('Tienda 1 · Centro','LIQ-002',19,10),
  ('Tienda 1 · Centro','DES-001',420,300), ('Tienda 1 · Centro','DES-002',380,300),

  ('Tienda 2 · Norte','CHI-001',9,10), ('Tienda 2 · Norte','CHI-002',15,8), ('Tienda 2 · Norte','CHI-003',19,8),
  ('Tienda 2 · Norte','ESP-001',2100,800), ('Tienda 2 · Norte','ESP-002',650,800), ('Tienda 2 · Norte','ESP-003',1800,600),
  ('Tienda 2 · Norte','POL-001',52,25), ('Tienda 2 · Norte','POL-002',18,25),
  ('Tienda 2 · Norte','LIQ-001',8,10), ('Tienda 2 · Norte','LIQ-002',24,10),
  ('Tienda 2 · Norte','DES-001',510,300), ('Tienda 2 · Norte','DES-002',290,300),

  ('Tienda 3 · Express','CHI-001',7,6), ('Tienda 3 · Express','CHI-002',9,6),
  ('Tienda 3 · Express','ESP-003',900,500), ('Tienda 3 · Express','POL-001',16,15),
  ('Tienda 3 · Express','POL-002',22,15), ('Tienda 3 · Express','LIQ-002',6,8)
) AS v(sede_nombre, sku, stock, minimo)
JOIN sedes s ON s.nombre = v.sede_nombre
JOIN productos p ON p.sku_codigo = v.sku
ON CONFLICT (sede_id, producto_id) DO NOTHING;
