## Implementación feature 7: Endpoints de descarga para el admin

### Archivos creados / modificados

- `apps/api/src/middleware/adminAuth.ts` — Middleware de autenticación admin independiente. Sesiones en memoria con HMAC-SHA256, cookie HttpOnly `admin_session`, verificación de credenciales contra ADMIN_USER/ADMIN_PASSWORD del entorno.
- `apps/api/src/routes/admin.ts` — 6 endpoints de admin: login, lista clientes, detalle cliente con grupos, descarga PDF combinado, descarga archivo original, cambio manual de estado.
- `apps/api/src/index.ts` — Registradas las rutas de admin con `app.route('/admin', adminRoutes)`.
- `apps/api/src/routes/admin.test.ts` — 16 tests cubriendo todos los endpoints y casos de error.

### Decisiones tomadas

- **Auth admin independiente:** Se creó un sistema de sesiones completamente separado del auth de cliente (cookie `admin_session` vs `session`, Map de sesiones separado, prefijo HMAC diferente). Esto evita cualquier contaminación cruzada entre sesiones de cliente y admin.
- **Admin system user para FK constraints:** La tabla `print_jobs` tiene `admin_id` como FK a `users.id`. Como el admin no se autentica contra la DB, se usa un usuario de sistema con ID `'admin'` que se crea en el seed/test setup. Documentado para que el seed de producción lo incluya.
- **Nota de dúplex personalizada:** El formato de la nota en `GET /admin/clients/:id` se genera en el handler (no se reutiliza la de `groupFilesByConfig`) para coincidir exactamente con el contrato de `docs/api.md` (singular/plural correcto: "1 documento... se añadirá 1 página en blanco" vs "2 documentos... se añadirán 2 páginas en blanco").
- **printedAt fallback:** Para archivos marcados como impresos manualmente (vía PATCH status, sin print_job), se usa `uploadedAt` como fallback del campo `printedAt`.
- **Cookie name `admin_session`:** Se usa un nombre de cookie diferente al de cliente para permitir que ambas sesiones coexistan sin conflicto.

### Tests añadidos

- `src/routes/admin.test.ts` — 16 tests:
  - `POST /admin/login — autenticación exitosa`
  - `POST /admin/login — credenciales inválidas`
  - `GET /admin/clients — lista clientes con conteo de pendientes`
  - `GET /admin/clients — ordena pendientes primero`
  - `GET /admin/clients/:id — detalle con grupos`
  - `GET /admin/clients/:id — 404 si cliente no existe`
  - `GET /admin/clients/:id/groups/:groupKey/download — descarga PDF y marca como printed`
  - `GET /admin/clients/:id/groups/:groupKey/download — registra print_job en DB`
  - `GET /admin/files/:fileId/original — descarga archivo original`
  - `PATCH /admin/files/:fileId/status — cambia estado a pending`
  - `PATCH /admin/files/:fileId/status — cambia estado a printed`
  - `GET /admin/* — 401 sin cookie de admin`
  - `GET /admin/* — 401 con cookie inválida`
  - `GET /admin/* — 401 en descarga sin auth`
  - `GET /admin/* — 401 en archivo original sin auth`
  - `GET /admin/* — 401 en cambio de status sin auth`

### Verificación ejecutada

- `bun test` — 60 tests pasan (44 existentes + 16 nuevos), 0 fallos
- `bun run build` — compila sin errores (324 módulos, 1.0 MB)
- `init.sh` — error menor de PATH en bash (bun no encontrado en WSL bash, pero funciona en PowerShell). No relacionado con la feature.

### Listo para revisión: SÍ
