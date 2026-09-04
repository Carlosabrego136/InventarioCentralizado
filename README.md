# Sistema de Inventario Palafox (panel de Cristian)

Este es el panel de control para Cristian: Resumen, Inventario, Traspasos y
Alertas de las 4 ubicaciones (Bodega Central + 3 tiendas). El punto de venta
que usan los trabajadores vive en un proyecto APARTE (palafox-pos), que
escribe en esta misma base de datos de Aiven.

No es un demo — cada acción (venta, traspaso, ajuste de mínimo) escribe
directo en la base de datos y persiste.

## Stack

- **Next.js 13** (páginas + API routes) — compatible con Node 16.14+
- **Postgres en Aiven** vía la librería `pg`
- CSS plano, sin Tailwind ni paso de build extra (ligero para hardware limitado)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Conectar tu base de datos de Aiven

1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Abre `.env.local` y pega tu **Service URI** de Aiven en `DATABASE_URL`
   (Aiven → tu servicio Postgres → Overview → "Service URI").

## 3. Crear las tablas y cargar el catálogo inicial

```bash
npm run db:init
```

Esto ejecuta `db/schema.sql` (crea las tablas) y `db/seed.sql` (carga las
4 sedes y un catálogo de ejemplo con stock inicial — varios productos quedan
a propósito por debajo del mínimo para que veas las alertas funcionando
desde el primer arranque).

**Para cargar el catálogo real de Cristian:** edita `db/seed.sql` con sus
productos, precios y stock reales antes de correr `npm run db:init`, o
avísame y te ayudo a generarlo desde su Excel/CSV.

## 4. Correr en local

```bash
npm run dev
```

Abre `http://localhost:3000`.

## 5. Subir a Vercel

```bash
vercel deploy
```

o conecta el repo de GitHub desde el dashboard de Vercel. En cualquier caso,
**agrega la variable de entorno `DATABASE_URL`** en Vercel → tu proyecto →
Settings → Environment Variables, con el mismo valor que pusiste en
`.env.local`.

## Estructura

```
palafox-inventario/
├─ db/
│  ├─ schema.sql      -- tablas (sedes, productos, inventario_sedes, traspasos, ventas, detalle_ventas)
│  ├─ seed.sql         -- catálogo y stock inicial (edítalo con datos reales de Cristian)
│  └─ init.js          -- corre schema + seed contra Aiven (npm run db:init)
├─ lib/
│  └─ db.js            -- conexión a Postgres (pool + transacciones)
├─ pages/
│  ├─ index.js          -- Resumen general (4 sedes)
│  ├─ inventario.js     -- Inventario por sede + edición de mínimos
│  ├─ traspasos.js      -- Traspasos entre sedes (transacción atómica)
│  ├─ pos.js             -- Punto de venta
│  ├─ alertas.js         -- Alertas de stock mínimo, por sede
│  └─ api/                -- endpoints reales (sedes, productos, inventario, traspasos, ventas, alertas)
├─ components/
│  └─ Layout.js          -- navegación (sidebar en escritorio, barra inferior en móvil)
└─ styles/
   └─ globals.css        -- interfaz blanca, tipografía grande, responsive
```

## Siguientes pasos sugeridos (cómo ir escalando)

1. **Catálogo real** — reemplazar `db/seed.sql` con los productos de Cristian, o usar la página **Productos** ya integrada para darlos de alta uno por uno.
2. **Notificación a Cristian** — conectar `/api/alertas` a un webhook de
   WhatsApp Business (vía n8n) para que le llegue la alerta sin tener que
   abrir el panel.
3. **Roles de acceso** — login simple para diferenciar el panel de Cristian
   (bodega) del acceso de cada tienda.

## Limpiar el catálogo de prueba

Cuando ya tengas el catálogo real (CSV de Cristian) listo para cargar, borra
todo lo de prueba con:

```bash
npm run db:limpiar
```

Esto vacía productos, inventario, traspasos, ventas y la bitácora — las 4
sedes (Bodega + 3 tiendas) se quedan intactas, listas para recibir productos
de verdad. Es un paso manual, no se corre solo.

## Ya incluido en esta versión

- **Catálogo por tienda de verdad**: cada tienda (y bodega) tiene su propio catálogo — un producto creado en una tienda NO aparece en las demás a menos que se le agregue explícitamente. Al crear un producto desde este sistema, eliges en qué tienda(s) aparece (botones "Bodega / Tienda 1 / Tienda 2 / Tienda 3").
- **Página Productos**: cada fila tiene botones para agregar/quitar el producto de cada tienda individualmente — quitar de una tienda NO lo quita de las demás.
- **Inventario por sede**: además de corregir stock/mínimo, ahora puedes "Quitar" un producto de esa tienda en particular.
- **Alertas con fecha y hora real**: cada alerta de stock mínimo muestra desde cuándo empezó (día de la semana, fecha y hora en 12h AM/PM) — no solo "está bajo", sino desde cuándo.
- **Actividad**: además de verse en tiempo real, ahora tiene botón para limpiar todo el historial.
- **Traspasos**: si mandas un producto a una tienda que no lo tenía en su catálogo, se le da de alta automáticamente ahí.
- **Fechas más detalladas**: en Reportes y Actividad, cada fecha muestra el día de la semana chico arriba (LUNES, MARTES, etc.) y la fecha/hora completa abajo.

- **Guardado por lote**: en Inventario y Productos, los campos ya no se guardan solos al salir del cuadro — ahora hay un botón "Guardar cambios" que se enciende solo cuando detecta algo sin guardar, y aplica todo junto al presionarlo.
- **Ayuda en pantalla**: cajitas explicando qué es SKU, Stock y Mínimo, justo donde se usan.
- **`npm run db:limpiar`**: borra el catálogo de prueba (productos, inventario, ventas) para arrancar limpio con datos reales, sin tocar las sedes.

## Fase 2: venta completa (precio mayoreo, venta por importe, en espera)

- **Precio mayoreo**: en Productos, puedes ponerle a cualquier producto un precio especial que se activa a partir de cierta cantidad (ej. "$15/kg normal, pero $12/kg desde 5kg"). En el punto de venta aparece como sugerencia, nunca se aplica solo sin que el cajero lo confirme.
- **Costo/Categoría/Marca/Caducidad**: agregados en la fase anterior, ya en uso en Productos e Inventario.
- **Ventas en espera**: tabla nueva (`ventas_en_espera`) — el uso real (pausar/retomar un ticket) vive en el proyecto del punto de venta.

## Finanzas (Fase 3)

Módulo nuevo — nada de lo anterior se tocó:

- **Curva de ganancias día por día**: ingresos, gastos+costo, y ganancia neta, en una sola gráfica (hecha con SVG puro, sin librerías nuevas — para no arriesgar el `npm install` en equipos viejos).
- **Comparativo por tienda**: barras mostrando qué tienda gana más en el mismo rango de fechas.
- **Gastos**: Cristian los registra como quiera — concepto libre, categoría libre (él decide qué categorías usar), por tienda o generales del negocio.
- **Ganancia neta = Ingresos − Costo de venta (según el costo de compra que le pusiste a cada producto) − Gastos**. Si un producto no tiene costo de compra cargado, cuenta como $0 en ese cálculo — está explicado en pantalla para que no se preste a confusión.

## Caja, movimientos y notificaciones (Fase 4)

- **Caja** (nueva página): historial de cortes (apertura/intermedio/cierre) de todas las tiendas, con la diferencia (sobrante/faltante) bien marcada en color. También el historial de depósitos y retiros de efectivo.
- **Todo se hace desde el punto de venta** — aquí en el central es solo supervisión, en tiempo real, de todas las tiendas juntas.
- **Campanita de notificaciones** (esquina superior del contenido): mismo cálculo que Alertas (stock bajo + caducidad), pero accesible desde cualquier página, con contador en vivo.

⚠️ Corre `npm run db:init` de nuevo — agrega las tablas `cortes_caja`, `movimientos_caja`, y la columna `metodo_pago` en `ventas`.

## Exportar a CSV (Fase 5)

Reportes, Finanzas (curva de ganancias y gastos), y Caja (cortes y
movimientos) tienen botón **"Exportar CSV"** — descarga un archivo que
abre directo en Excel o Google Sheets, con el filtro de fecha/tienda que
tengas puesto en pantalla. Útil para llevárselo a un contador o guardar
un respaldo. No requiere nada nuevo instalado — se genera en el navegador.

## Ticket personalizado por tienda (nuevo)

Página **Ticket** en el menú — Cristian le puede poner a cada tienda su
propia dirección, teléfono y mensaje de pie de página para el recibo que
se imprime en el punto de venta. Todo opcional; si una tienda no tiene
nada configurado, el ticket usa el mensaje genérico de siempre.

⚠️ Corre `npm run db:init` de nuevo — agrega 3 columnas nuevas a `sedes`
(`recibo_direccion`, `recibo_telefono`, `recibo_mensaje`).
