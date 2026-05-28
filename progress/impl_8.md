## Implementación feature 8: Sesión anónima: archivos en memoria de servidor

### Archivos creados / modificados

- `apps/api/src/middleware/auth.ts` — modificado: AppEnv con userId/sessionId opcionales e isAnonymous, Session con anonymous flag, createAnonymousSession(), optionalAuthMiddleware, authMiddleware actualizado para rechazar sesiones anónimas
- `apps/api/src/services/storage.ts` — modificado: añadidas saveAnonymousFile() y moveAnonymousFiles() para gestión de archivos anónimos y migración física
- `apps/api/src/routes/session.ts` — creado: endpoint POST /session/convert y función exportable convertAnonymousSession()
- `apps/api/src/routes/files.ts` — modificado: todos los endpoints cambiados de authMiddleware a optionalAuthMiddleware, soporte completo para sesiones anónimas (upload, list, get, config, status, delete)
- `apps/api/src/routes/auth.ts` — modificado: GET /auth/me con soporte limpio para anonymous, POST /auth/register con migración automática de archivos anónimos
- `apps/api/src/index.ts` — modificado: registro de rutas de sesión (/session)
- `apps/api/src/routes/files.test.ts` — modificado: 2 tests actualizados (upload sin auth ahora devuelve 201, GET /files sin auth ahora devuelve 200 con lista vacía)
- `apps/api/src/routes/session.test.ts` — creado: 10 tests de sesión anónima

### Decisiones tomadas

- **Sesiones anónimas en el mismo Map que autenticadas:** se usa un flag `anonymous: true` en el objeto Session para diferenciar. Más simple que mantener dos Maps separados.
- **optionalAuthMiddleware crea sesión si no existe:** cada request sin cookie a /files genera automáticamente una sesión anónima nueva. Esto garantiza que siempre hay un sessionId disponible tras el middleware.
- **authMiddleware rechaza sesiones anónimas:** el middleware estricto (usado en rutas que requieren auth) verifica que `session.userId` exista, rechazando sesiones anónimas con 401.
- **Conversión como función exportable:** `convertAnonymousSession()` es una función pura que se llama tanto desde POST /auth/register como desde POST /session/convert. Evita duplicación y hace la lógica testeable.
- **moveAnonymousFiles devuelve Map<oldPath, newPath>:** permite al convertidor actualizar storage_path en DB de forma precisa para cada archivo.
- **Condición de propiedad dual:** los endpoints de /files verifican propiedad por userId (autenticado) O sessionId + userId IS NULL (anónimo). El `isNull(files.userId)` en la condición anónima previene acceso a archivos de otros usuarios vía sessionId.
- **Cookie de sesión sin maxAge:** tanto sesiones autenticadas como anónimas usan cookies de sesión (sin expiración explícita). La diferencia es conceptual: las sesiones anónimas son temporales en el servidor.

### Tests añadidos

- `apps/api/src/routes/session.test.ts` — 10 tests:
  1. POST /files/upload — usuario anónimo sube archivo sin autenticación
  2. POST /files/upload — archivo anónimo se guarda en storage/anonymous/{session_id}/
  3. GET /files — usuario anónimo ve solo sus archivos de sesión
  4. GET /auth/me — devuelve anonymous: true con sessionId
  5. POST /auth/register — migra archivos anónimos al registrarse
  6. POST /session/convert — migra archivos de sesión anónima a usuario
  7. POST /session/convert — mueve archivos físicos a la carpeta del usuario
  8. POST /session/convert — actualiza storage_path en DB
  9. PATCH /files/:id/config — usuario anónimo puede configurar sus archivos
  10. DELETE /files/:id — usuario anónimo puede eliminar sus archivos

### Verificación ejecutada

- `bun test` — 70 tests pasan (60 existentes + 10 nuevos), 0 fallos, 327 expect() calls
- `bun run build` — compila sin errores (325 módulos, 147ms)
- `./init.sh` — error menor de PATH en bash/Windows (bun no encontrado en bash, funciona en PowerShell). No es un bloqueo real.

### Listo para revisión: SÍ
