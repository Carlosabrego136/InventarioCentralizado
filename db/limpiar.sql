-- Borra TODO lo operativo / de prueba: catálogo, stock, traspasos, ventas,
-- bitácora, cortes y movimientos de caja, gastos y tickets en espera.
-- NO se tocan: sedes (Bodega + tiendas), usuarios (cuentas de trabajadores)
-- ni los datos del ticket de cada tienda (están en la tabla sedes).
-- Es una sola sentencia: o se borra todo o no se borra nada.
TRUNCATE TABLE
  detalle_ventas, ventas, traspasos, inventario_sedes, productos, bitacora,
  cortes_caja, movimientos_caja, gastos, ventas_en_espera
  RESTART IDENTITY CASCADE;
