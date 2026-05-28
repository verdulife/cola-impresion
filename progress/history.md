# Historial de sesiones

> Archivo append-only. Nunca borrar entradas anteriores.
> Cada sesión cerrada añade una entrada al final.

---

<!-- Plantilla de entrada:

## Sesión YYYY-MM-DD

**Feature:** [id] Título de la feature
**App:** web | admin | api | infra
**Duración:** ~Xh

### Resumen
Qué se implementó y cómo funciona.

### Archivos creados / modificados
- `ruta/al/archivo.ts` — descripción breve
- ...

### Decisiones relevantes
- Por qué se eligió X sobre Y
- ...

### Tests añadidos
- `ruta/al/test.ts` — qué prueba

---
-->

## Sesión 2026-05-27

**Feature:** 1 — Configuración inicial del monorepo y Docker
**App:** api + infraestructura monorepo
**Duración:** ~30min

### Resumen
Estructura base del monorepo con bun workspaces, tipos compartidos en packages/shared, API mínima con Hono, y configuración Docker (Dockerfile, docker-compose.yml, Caddyfile) para producción.

### Archivos creados
- `.gitignore` — reglas de exclusión raíz
- `package.json` — raíz del monorepo con workspaces
- `packages/shared/package.json` — paquete @cola-impresion/shared
- `packages/shared/tsconfig.json` — TypeScript strict
- `packages/shared/src/index.ts` — tipos de dominio (FileStatus, PrintConfig, etc.)
- `apps/api/package.json` — Hono + shared workspace
- `apps/api/tsconfig.json` — TypeScript strict con paths
- `apps/api/src/index.ts` — servidor Hono mínimo (GET / → { status: "ok" })
- `apps/api/.env.example` — variables de entorno
- `apps/api/Dockerfile` — adaptado para monorepo (context raíz)
- `docker-compose.yml` — servicios api + caddy
- `Caddyfile` — reverse proxy
- `apps/web/.gitkeep` — placeholder
- `apps/admin/.gitkeep` — placeholder

### Decisiones relevantes
- Dockerfile adaptado: context = raíz del monorepo (no ./apps/api) porque bun.lock y packages/shared están en la raíz. Necesario para que bun install funcione dentro del contenedor.
- bun.lock (texto) en vez de bun.lockb (binario): Bun 1.3.10+ genera formato texto por defecto.

### Tests añadidos
- Ninguno (feature de infraestructura, verificación mediante arranque)

---

## Sesión 2026-05-27 (continuación)

**Features:** 2 a 6 — Backend completo (DB, auth, archivos, config, motor PDF)
**App:** api
**Duración:** ~2h

### Resumen
Implementación del backend completo de la API: base de datos SQLite con Drizzle ORM, sistema de autenticación con cookies persistentes, subida y gestión de archivos, CRUD de configuración de impresión, y motor de agrupación y fusión de PDFs con soporte dúplex.

### Archivos creados / modificados
- `apps/api/src/db/schema.ts` — 5 tablas (users, files, print_configs, print_jobs, print_job_files)
- `apps/api/src/db/index.ts` — conexión bun:sqlite + Drizzle, WAL mode
- `apps/api/src/db/migrate.ts` — script de migraciones
- `apps/api/src/db/seed.ts` — datos de prueba (2 usuarios, 6 archivos)
- `apps/api/src/db/migrations/` — migración inicial generada por Drizzle Kit
- `apps/api/drizzle.config.ts` — configuración de Drizzle Kit
- `apps/api/src/middleware/auth.ts` — middleware de auth, session store en memoria, cookies HMAC-SHA256
- `apps/api/src/routes/auth.ts` — POST register/login/logout, GET me
- `apps/api/src/routes/auth.test.ts` — 11 tests de autenticación
- `apps/api/src/routes/files.ts` — POST upload, GET list/detail, PATCH config/status, DELETE
- `apps/api/src/routes/files.test.ts` — 20 tests de archivos
- `apps/api/src/services/storage.ts` — saveFile, deleteFile, sanitizeFilename
- `apps/api/src/services/pdfMerger.ts` — groupFilesByConfig, generateCombinedPdf
- `apps/api/src/services/pdfMerger.test.ts` — 13 tests del motor de PDF
- `packages/shared/src/index.ts` — tipos GroupableFile y FileGroup añadidos
- `docs/api.md` — sección GET /files/:id añadida

### Decisiones relevantes
- `bun:sqlite` en vez de `better-sqlite3`: Bun no soporta módulos nativos de Node en Windows. Drizzle tiene driver oficial para bun:sqlite.
- Variables de entorno lazy: se leen dentro de funciones para evitar problemas de caché de módulos entre archivos de test en Bun.
- Sesiones en memoria (Map): suficiente para V1, sin necesidad de tabla de sesiones en DB.
- HMAC-SHA256 para cookies: firmado con SESSION_SECRET, sin librerías externas.
- Páginas en blanco dúplex heredan tamaño de la última página del documento (no A4 fijo).

### Tests añadidos
- `src/routes/auth.test.ts` — 11 tests (register, login, logout, me, validaciones)
- `src/routes/files.test.ts` — 20 tests (upload, list, detail, config, status, delete, auth, permisos)
- `src/services/pdfMerger.test.ts` — 13 tests (agrupación, dúplex par/impar/mixto, simplex, orden, conteo)
- **Total: 44 tests, 0 fallos**

---

## Sesión 2026-05-28

**Features:** 7 y 8 — Backend completo (endpoints admin + sesión anónima)
**App:** api
**Duración:** ~1h

### Resumen
Implementación de los endpoints de administración (lista de clientes, detalle con grupos, descarga de PDFs combinados, descarga de archivos originales, cambio manual de estado) y el sistema de sesión anónima (uploads sin autenticación, migración automática al registrarse).

### Archivos creados / modificados
- `apps/api/src/middleware/adminAuth.ts` — auth admin independiente con cookie admin_session
- `apps/api/src/routes/admin.ts` — 6 endpoints admin (login, clients, detail, download, original, status)
- `apps/api/src/routes/admin.test.ts` — 16 tests de endpoints admin
- `apps/api/src/routes/session.ts` — POST /session/convert para migrar archivos anónimos
- `apps/api/src/routes/session.test.ts` — 10 tests de flujo anónimo
- `apps/api/src/middleware/auth.ts` — optionalAuthMiddleware, sesiones anónimas, AppEnv extendido
- `apps/api/src/routes/files.ts` — todos los endpoints funcionan con userId O sessionId
- `apps/api/src/routes/auth.ts` — GET /auth/me soporta anonymous, POST /auth/register migra archivos
- `apps/api/src/services/storage.ts` — saveAnonymousFile, moveAnonymousFiles
- `apps/api/src/index.ts` — registro de rutas /session
- `docs/api.md` — sección POST /admin/login añadida
- `init.ps1` — script de verificación para Windows PowerShell
- `AGENTS.md`, `CHECKPOINTS.md`, `docs/verification.md`, `docs/architecture.md` — documentación de init.ps1
- `.opencode/agents/*.md` — referencias a init.ps1

### Decisiones relevantes
- **Auth admin independiente**: cookie `admin_session` separada de la cookie de cliente, sesiones en Map propio.
- **Admin system user** (ID='admin') para satisfacer la FK constraint de `print_jobs.admin_id`.
- **optionalAuthMiddleware**: crea sesión anónima automáticamente si no hay cookie, permite uploads sin registro previo.
- **Condición de propiedad dual**: `userId` O `sessionId + isNull(userId)` previene acceso cruzado entre sesiones.
- **convertAnonymousSession()** como función exportable reutilizada por `/auth/register` y `/session/convert`.
- **moveAnonymousFiles()** devuelve Map<oldPath, newPath> para actualizar storage_path en DB con precisión.

### Tests añadidos
- `src/routes/admin.test.ts` — 16 tests (login, clients, detail, download, original, status, auth)
- `src/routes/session.test.ts` — 10 tests (upload anónimo, aislamiento, config, delete, migración)
- **Total: 70 tests, 0 fallos**

---

## Sesión 2026-05-28 (continuación)

**Feature:** 9 — Scaffolding y configuración de la app cliente (SvelteKit)
**App:** web
**Duración:** ~15min

### Resumen
Scaffolding completo de `apps/web` con SvelteKit + TypeScript + Tailwind CSS v4. El build pasa y el type check no tiene errores. Las rutas están creadas con contenido placeholder. Los tokens de diseño de DESIGN.md están configurados en `app.css`.

### Archivos creados / modificados
- `apps/web/package.json` — SvelteKit 2 + Tailwind CSS v4 + @tailwindcss/vite
- `apps/web/svelte.config.js` — configuración SvelteKit
- `apps/web/vite.config.ts` — Tailwind + SvelteKit plugins
- `apps/web/tsconfig.json` — TypeScript strict
- `apps/web/src/app.html` — HTML base
- `apps/web/src/app.css` — tokens de diseño en @theme (colores, tipografía, espaciado, border-radius)
- `apps/web/src/routes/+layout.svelte` — layout base con min-h-screen bg-surface
- `apps/web/src/routes/+page.svelte` — placeholder "Próximamente"
- `apps/web/src/routes/auth/login/+page.svelte` — placeholder
- `apps/web/src/routes/auth/register/+page.svelte` — placeholder
- `apps/web/src/routes/settings/+page.svelte` — placeholder
- `apps/web/.env` — PUBLIC_API_URL=http://localhost:3001
- `apps/web/.env.example` — template
- `apps/web/.gitignore` — excluye .svelte-kit, node_modules
- `apps/web/src/lib/components/.gitkeep`, `utils/.gitkeep`, `stores/.gitkeep` — estructura lib
- `apps/web/static/.gitkeep` — static assets

### Decisiones relevantes
- Tailwind CSS v4 con `@tailwindcss/vite` plugin (no postcss.config.cjs) según docs/conventions.md
- Layout sin header persistente: correcto según ux.md ("no tiene barra de navegación persistente")
- El script de test en package.json es `echo "No tests yet"` — init.ps1 genera falso positivo porque busca "pass|ok|passed" en la salida de `bun test`

### Verificación
- `bun run build` — pasa (160 módulos, built in ~6s)
- `bun run check` — 0 errores, 1 warning no crítico (missing @types/node)
- `bun test` — 0 test files (esperado, scaffolding puro)

---

## Sesión 2026-05-28 (continuación)

**Feature:** 10 — Pantallas de login y registro
**App:** web
**Duración:** ~20min

### Resumen
Implementación de los formularios de login y registro para la app cliente. Usa SvelteKit form actions + server actions para llamar a los endpoints del backend. Validación en cliente con JavaScript, errores inline en rojo debajo de cada campo.

### Archivos creados / modificados
- `apps/web/src/routes/auth/login/+page.svelte` — formulario con email + password, validación, errores inline, enlace a register
- `apps/web/src/routes/auth/login/+page.server.ts` — action que hace fetch POST a /auth/login con credentials: 'include', redirige a / si éxito
- `apps/web/src/routes/auth/register/+page.svelte` — formulario con email + password (mín 8 chars), validación, errores inline, enlace a login
- `apps/web/src/routes/auth/register/+page.server.ts` — action que hace fetch POST a /auth/register con credentials: 'include', redirige a / si éxito

### Decisiones relevantes
- Uso de form actions de SvelteKit (+page.server.ts) en vez de fetch directo desde el cliente
- `credentials: 'include'` en los fetch para enviar cookies de sesión
- Validación en cliente con handleSubmit() y regex para email
- Errores del servidor mostrados inline con `text-error` (no toast)

### Verificación
- `bun run build` — pasa (5.74s)
- `bun run check` — 0 errores

---
