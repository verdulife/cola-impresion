## Implementación feature 3: Autenticación: registro y login con cookie persistente

### Archivos creados / modificados

- `apps/api/src/middleware/auth.ts` — **Creado.** Middleware de autenticación Hono, session store en memoria (Map), firma/verificación de cookies con HMAC-SHA256 usando SESSION_SECRET, helpers para crear/eliminar sesiones y cookies, y función `resolveSession()` reutilizable.
- `apps/api/src/routes/auth.ts` — **Creado.** Cuatro endpoints: POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me. Validación de email y contraseña, hash con Bun.password.hash (bcrypt), verificación con Bun.password.verify.
- `apps/api/src/routes/auth.test.ts` — **Creado.** 11 tests cubriendo todos los casos obligatorios de verificación.
- `apps/api/src/index.ts` — **Modificado.** Registro de rutas de auth con `app.route('/auth', authRoutes)`. Exportación nombrada de `app` para uso en tests.
- `apps/api/src/db/index.ts` — **Modificado.** Añadida guarda para `DATABASE_URL=:memory:` (evita `mkdirSync` en directorio inexistente para DB en memoria, necesario para tests).

### Decisiones tomadas

- **Sesiones en memoria (Map):** Siguiendo la especificación, las sesiones se almacenan en un `Map<sessionId, {userId, createdAt}>` en el servidor. Aceptable para V1; se perderán al reiniciar el servidor.
- **Firma de cookies con HMAC-SHA256:** El valor de la cookie es `sessionId.hmacSignature`, donde la firma se genera con `crypto.subtle` usando `SESSION_SECRET`. Esto previene la falsificación de session IDs incluso si son UUIDs.
- **`resolveSession()` como función compartida:** En lugar de duplicar lógica de verificación de cookies en cada endpoint, se exporta `resolveSession(c)` que devuelve la sesión o null. El middleware `authMiddleware` la usa internamente, y los endpoints `/logout` y `/me` también la usan directamente.
- **`/me` y `/logout` sin middleware de auth:** `/me` devuelve 200 con `user: null` si no hay sesión (no 401). `/logout` funciona incluso sin sesión (limpia la cookie igualmente). Por eso no usan `authMiddleware` directamente.
- **Estructura preparada para sesiones anónimas (feature 8):** El endpoint `/me` incluye la rama para sesiones anónimas (`anonymous: true, sessionId`), aunque no se crean en esta feature.
- **Tests con DB en memoria:** Se usa `process.env.DATABASE_URL = ':memory:'` antes de los imports dinámicos para crear una DB efímera por archivo de test. Las migraciones se ejecutan normalmente sobre la DB en memoria.
- **`getSetCookie()` para extraer cookies en tests:** Se usa el método nativo `Response.headers.getSetCookie()` para verificar que las cookies se establecen y eliminan correctamente.

### Tests añadidos

- `src/routes/auth.test.ts` — 11 tests:
  1. `POST /auth/register — crea usuario y devuelve 201`
  2. `POST /auth/register — devuelve 409 si el email ya existe`
  3. `POST /auth/register — devuelve 400 si la contraseña es < 8 chars`
  4. `POST /auth/register — devuelve 400 si el email no es válido`
  5. `POST /auth/login — devuelve 200 con credenciales correctas`
  6. `POST /auth/login — devuelve 401 con credenciales incorrectas`
  7. `POST /auth/login — devuelve 401 si el email no existe`
  8. `POST /auth/logout — elimina la sesión`
  9. `GET /auth/me — devuelve usuario autenticado`
  10. `GET /auth/me — devuelve null sin sesión`
  11. `GET /auth/me — devuelve null con cookie inválida`

### Verificación ejecutada

- `bun test` → **11 pass, 0 fail, 45 expect() calls** ✅
- `bun run build` → **Bundled 145 modules in 76ms** ✅
- `bun run src/index.ts` → **Servidor arranca en puerto 3001** ✅
- `./init.sh` → El único error es `bun no encontrado` (falso positivo: el script usa `which` que no existe en PowerShell/Windows; bun está instalado y funcional)

### Listo para revisión: SÍ
