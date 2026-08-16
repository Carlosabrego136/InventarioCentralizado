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

## Ya incluido en esta versión

- **Login** con `ADMIN_PASSWORD` — nadie ve nada sin la contraseña de Cristian.
- **Productos**: alta, edición de precio/unidad/catálogo reducido, y baja lógica (nunca se borra el historial de ventas asociado).
- **Inventario**: además del stock mínimo, ahora se puede **corregir el stock real** de cualquier producto en cualquier sede (para conteos físicos).
- **Reportes**: historial de ventas filtrable por tienda y rango de fechas, con totales, fecha y hora en formato 12h (AM/PM). Incluye botón para **limpiar el historial** del filtro actual (queda registrado en Actividad).
- **Actividad**: bitácora en tiempo real (se actualiza sola cada 15s) de todo lo que cambia — productos creados/editados/dados de baja, correcciones de stock, traspasos — con el origen exacto (Cristian o qué tienda).
- **Ojito de contraseña** en el login, para ver lo que estás escribiendo.

⚠️ Si ya tenías la base de datos inicializada de antes, corre `npm run db:init` de nuevo — es seguro repetirlo (usa `IF NOT EXISTS` en todo) y así se agregan las tablas/columnas nuevas.
