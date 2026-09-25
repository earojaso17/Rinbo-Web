# admin/ — RINBŌ Admin (fases 3 y 5)

App de gestión (Vite + React + supabase-js), pensada primero para celular. No se publica en rinbo.store.

- `src/config.js`: URL de Supabase y llave **publishable** (pública por diseño; los datos los protegen RLS y Cloudflare Access).
- `src/lib/datos.js`: TODO el acceso a Supabase (esquema `rinbo`). `src/lib/fotos.js`: compresión en el navegador (WebP 1200 y 600 px; JPEG si el navegador no hace WebP; máx. 1 MB).
- Páginas (`src/paginas/`): Entrar (correo + contraseña; solo cuentas en `rinbo.admins`), Inicio (resumen y espacio del plan gratis, borrar fotos sin uso), Productos (buscar, filtrar, publicar/ocultar), ProductoForm (crear/editar/borrar, fotos: subir, ordenar, borrar).
- Fase 5 (`src/paginas/`): Pedidos (lista con filtros En curso / Con saldo / Entregados), PedidoNuevo (cliente existente o nuevo + total),
  PedidoDetalle (link y mensaje de seguimiento por WhatsApp, cambiar código secreto, etapas con fecha/comentario/visible, cuenta y pagos,
  fotos de evidencia privadas con 👁 visible/oculta, artículos, datos y notas internas, "Mi control": precio de venta, costo, impuestos y utilidad calculada; la lista suma la utilidad), Clientes y ClienteForm (con sus pedidos).
- Fase 10 (`src/lib/Resumen.jsx`, en Inicio): cifras del mes, gráficos de pedidos y ganancia por mes (12 meses, SVG propio), tabla por mes y botón "Descargar Excel" (`exportarExcel()` en datos.js, librería `write-excel-file` cargada solo al descargar): hojas Pedidos, Artículos, Pagos, Clientes, Productos y Resumen por mes. Los meses se cuentan en hora de Chile. La ganancia solo suma pedidos con costo o impuestos registrados.
- Rutas con `#` (`#/productos/<código>`, `#/pedidos/<id>`, `#/pedidos/nuevo?cliente=<id>`, `#/clientes/<id>`), así funciona en cualquier hosting estático.

## Probar en el computador
```
cd admin && npm install && npm run dev
```

## Publicar (Cloudflare Pages, proyecto aparte "rinbo-admin")
- Repositorio `Rinbo-Web`, rama de producción `main`.
- Directorio raíz: `admin` · Comando de build: `npm run build` · Directorio de salida: `dist` · Variable `NODE_VERSION = 22`.
- Protegerlo con **Cloudflare Access** (Zero Trust → Access → Aplicación "Self-hosted" para `rinbo-admin.pages.dev`, política: solo `hola@rinbo.store`, código por correo).
- `public/_headers`: noindex y no se puede incrustar en otros sitios.

## Requisito en Supabase (hecho 2026-09-25)
El esquema `rinbo` debe estar en **Exposed schemas** de la Data API (Project Settings → Data API). Es seguro: `anon` no tiene
ningún permiso sobre `rinbo` y todas las tablas tienen RLS solo-admin. Sin eso, la app muestra
"La base de datos aún no está habilitada para la Admin".

## Botón "Publicar cambios ahora"
- `functions/api/publicar.js` es una **Cloudflare Pages Function** (corre en Cloudflare, no en el navegador): exige la sesión de un
  admin (`rinbo.es_admin()`) y pide a GitHub correr el workflow `pages.yml` en `main` (`workflow_dispatch`). `GET` devuelve el estado.
- Necesita el secreto **`GITHUB_TOKEN`** en Cloudflare (rinbo-admin → Settings → Variables and Secrets, tipo *Secret*):
  token *fine-grained* de GitHub, solo repo `Rinbo-Web`, permiso **Actions: Read and write**. Vence: renovarlo antes de la fecha elegida.
- En `npm run dev` no hay funciones: el botón muestra un error (normal).
