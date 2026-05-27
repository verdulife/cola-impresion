## Implementación feature 5: CRUD de configuración de impresión por archivo

### Archivos creados / modificados

- `apps/api/src/routes/files.ts` — Añadidos 5 endpoints nuevos:
  - `GET /files` — Lista archivos del usuario autenticado con filtro opcional por status
  - `GET /files/:id` — Detalle de un archivo con su configuración de impresión
  - `PATCH /files/:id/config` — Actualización parcial de la configuración de impresión
  - `PATCH /files/:id/status` — Cambio de estado del archivo (para reimprimir)
  - `DELETE /files/:id` — Eliminación de archivo (disco + DB con CASCADE)
- `apps/api/src/routes/files.test.ts` — Añadidos 13 tests nuevos para los endpoints CRUD

### Decisiones tomadas

- **JOIN vs queries separadas:** Se usa LEFT JOIN entre `files` y `print_configs` en una sola query para GET /files y GET /files/:id, aprovechando que cada archivo tiene exactamente un print_config (constraint UNIQUE).
- **Filtrado por status en memoria:** El filtro por status en GET /files se hace en memoria después del JOIN, ya que SQLite no permite filtrar fácilmente en el JOIN sin complicar la query. El volumen esperado es bajo (cientos de archivos por usuario).
- **Detección de FORBIDDEN vs NOT_FOUND:** Para distinguir entre "no existe" y "no te pertenece", se hace una segunda query cuando la primera no devuelve resultados. Esto evita filtrar información sobre la existencia de archivos ajenos.
- **Función helper `toFileResponse`:** Se extrajo la lógica de mapeo DB → respuesta API en una función reutilizable para mantener consistencia entre todos los endpoints.
- **Validación con arrays `as const`:** Los valores válidos de size, color, sides, paper y status se definen como arrays `as const` para obtener tipado estricto y autocompletado.
- **Helper `uploadTestPdf`:** Se añadió un helper de test para subir PDFs de forma concisa y reutilizable en los nuevos tests.

### Tests añadidos

- `GET /files — lista archivos del usuario autenticado` — Verifica estructura completa de la respuesta con 2 archivos
- `GET /files — filtra por status=pending` — Sube 2 archivos, cambia uno a printed, verifica que el filtro devuelve solo el pending
- `GET /files — devuelve 401 sin autenticación` — Verifica que requiere sesión
- `GET /files/:id — devuelve detalle del archivo` — Verifica todos los campos incluyendo config
- `GET /files/:id — devuelve 404 si no existe` — UUID inexistente
- `GET /files/:id — devuelve 403 si no pertenece al usuario` — Dos usuarios, uno intenta acceder al archivo del otro
- `PATCH /files/:id/config — actualiza configuración parcialmente` — Envía solo size y color, verifica que sides y paper se mantienen
- `PATCH /files/:id/config — devuelve 400 con valor inválido` — Envía size: "B5" (no válido)
- `PATCH /files/:id/config — devuelve 403 si no pertenece al usuario` — Dos usuarios
- `PATCH /files/:id/status — cambia estado a pending` — Cambia a printed y luego vuelve a pending (reimprimir)
- `DELETE /files/:id — elimina archivo y registro` — Verifica eliminación en DB (files + print_configs por CASCADE) y en disco
- `DELETE /files/:id — devuelve 404 si no existe` — UUID inexistente
- `DELETE /files/:id — devuelve 403 si no pertenece al usuario` — Verifica que el archivo sigue existiendo tras el intento fallido

### Verificación ejecutada

- `./init.sh` — ✅ Termina sin errores (exit code 0)
- `bun test` — ✅ 31 tests pasan (18 existentes + 13 nuevos), 149 expect() calls
- `bun run build` — ✅ Compila sin errores (321 módulos, 1.0 MB)

### Listo para revisión: SÍ
