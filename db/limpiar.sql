-- Borra TODO el catálogo de prueba (productos, stock, traspasos, ventas)
-- para arrancar limpio con el catálogo real. Las sedes NO se tocan.
TRUNCATE TABLE detalle_ventas, ventas, traspasos, inventario_sedes, productos, bitacora
  RESTART IDENTITY CASCADE;
