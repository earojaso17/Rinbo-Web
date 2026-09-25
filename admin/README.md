# admin/ — RINBŌ Admin (fase 3)

App de gestión (Vite + React + supabase-js), pensada primero para celular. No se publica en rinbo.store.

- `src/config.js`: URL de Supabase y llave **publishable** (pública por diseño; los datos los protegen RLS y Cloudflare Access).
- `src/lib/datos.js`: TODO el acceso a Supabase (esquema `rinbo`). `src/lib/fotos.js`: compresión en el navegador (WebP 1200 y 600 px; JPEG si el navegador no hace WebP; máx. 1 MB).
- Páginas (`src/paginas/`): Entrar (correo + contraseña; solo cuentas en `rinbo.admins`), Inicio (resumen y espacio del plan gratis, borrar fotos sin uso), Productos (buscar, filtrar, publicar/ocultar), ProductoForm (crear/editar/borrar, fotos: subir, ordenar, borrar).
- Rutas con `#` (`#/productos/<código>`), así funciona en cualquier hosting estático.

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
