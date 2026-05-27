## Implementación feature 4: Subida de archivos al servidor

### Archivos creados / modificados

- `apps/api/src/services/storage.ts` — **creado** — Servicio de almacenamiento en disco: `saveFile`, `deleteFile`, `sanitizeFilename`. Estructura `{storagePath}/{userId}/{fileId}_{sanitizedFilename}`.
- `apps/api/src/routes/files.ts` — **creado** — Ruta `POST /files/upload` con authMiddleware. Valida tipo MIME (PDF, JPG, PNG, TIFF) y tamaño máximo (50MB configurable). Cuenta páginas con pdf-lib para PDFs (1 para imágenes). Inserta en `files` y `print_configs` con transacción.
- `apps/api/src/routes/files.test.ts` — **creado** — 7 tests que cubren todos los casos obligatorios.
- `apps/api/src/index.ts` — **modificado** — Registro de `fileRoutes` bajo prefijo `/files`.
- `apps/api/.env.example` — **modificado** — Añadidas variables `MAX_FILE_SIZE_MB=50` y `FILE_EXPIRY_DAYS=90`.
- `apps/api/package.json` — **modificado** (por `bun add`) — Añadida dependencia `pdf-lib@1.17.1`.

### Decisiones tomadas

- **Variables de entorno lazy:** `STORAGE_PATH`, `MAX_FILE_SIZE_MB` y `FILE_EXPIRY_DAYS` se leen dentro de funciones (`getStoragePath()`, `getMaxFileSizeBytes()`, `getFileExpiryDays()`) en vez de como constantes a nivel de módulo. Razón: Bun comparte la caché de módulos entre archivos de test, y si `auth.test.ts` carga primero (sin setear estas vars), los valores quedarían fijados con los defaults incorrectos para los tests de files.
- **`filename` y `originalName` iguales en esta feature:** Ambos campos se rellenan con `file.name` (nombre original). El campo `filename` podría sanitizarse en el futuro si se necesita, pero el contrato de API no lo exige y la sanitización ya se aplica al nombre en disco.
- **Conteo de páginas con fallback:** Si `PDFDocument.load()` falla (PDF corrupto o inválido), `pageCount` se establece a 1 en vez de rechazar el archivo. El archivo ya está guardado en disco y registrado; el conteo de páginas es un metadato secundario.
- **Transacción DB para insertar files + print_configs:** Si la inserción en `print_configs` falla, se hace rollback de `files` también, evitando registros huérfanos.
- **`storage/` ya estaba en `.gitignore`:** No fue necesario modificarlo.

### Tests añadidos

`apps/api/src/routes/files.test.ts` — 7 tests:

1. `sube PDF correctamente y devuelve 201` — Verifica respuesta completa: id, name, mimeType, sizeBytes, pageCount (3), status, uploadedAt, expiresAt, config por defecto.
2. `sube imagen JPG correctamente` — Verifica que las imágenes se aceptan y pageCount = 1.
3. `devuelve 400 si el tipo no es válido` — Un archivo .txt devuelve `INVALID_FILE_TYPE`.
4. `devuelve 400 si el archivo supera 50MB` — Blob de 51MB devuelve `FILE_TOO_LARGE`.
5. `devuelve 401 sin autenticación` — Sin cookie de sesión devuelve `UNAUTHORIZED`.
6. `el archivo se guarda en disco` — Verifica con `existsSync` y `readdirSync` que el archivo existe en la estructura de carpetas esperada.
7. `se crea print_config con valores por defecto` — Consulta directa a DB verifica A4, bw, single, normal-90.

### Verificación ejecutada

- `bun test` → **18/18 tests pasan** (11 auth + 7 files), 87 expect() calls
- `bun run build` → **compila sin errores** (321 módulos, 1.0 MB)
- `./init.sh` → el único error es `bun no encontrado` por problema de PATH entre bash/PowerShell en Windows (preexistente, no relacionado con esta feature). Bun funciona correctamente desde PowerShell (`bun --version` → 1.3.10).
- `.gitignore` → `storage/` ya incluido

### Listo para revisión: SÍ
