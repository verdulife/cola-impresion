## Revisión feature 4: Subida de archivos al servidor

### Resultado: APROBADO

### Checkpoints evaluados

- [x] C1 — El arnés está completo y operativo
      Todos los archivos base existen (AGENTS.md, CHECKPOINTS.md, DESIGN.md, feature_list.json, init.sh, progress/current.md, progress/history.md).
      Todos los docs existen (architecture.md, conventions.md, ux.md, api.md, infrastructure.md, verification.md).
      Definiciones de agentes presentes (leader.md, implementer.md, reviewer.md).
      Nota: init.sh falla por PATH de bun en bash/Windows (preexistente, no relacionado con esta feature). Bun funciona correctamente desde PowerShell.

- [x] C2 — El estado es coherente
      Solo una feature en in_progress (feature 4). Features 1-3 en done.
      progress/current.md describe la sesión activa correctamente con plan, decisiones y archivos modificados.
      No hay discrepancia entre feature_list.json y el código existente.

- [x] C3 — El código respeta la arquitectura
      Todos los archivos nuevos están en apps/api (correcto según docs/architecture.md).
      storage.ts en src/services/ — capa de servicio, correcto.
      files.ts en src/routes/ — capa de rutas, correcto.
      No hay lógica de negocio en UI (feature de backend puro).
      No hay llamadas directas a DB desde frontend.
      No hay console.log de debug. Los console.log encontrados son operativos:
        - index.ts:23 — log de arranque del servidor
        - db/migrate.ts — logs de migraciones
        - db/seed.ts — logs del script de seed
      No hay TODOs sin contexto ni archivos temporales.

- [x] C5 — El contrato de API se respeta
      POST /files/upload documentado en docs/api.md antes de la implementación.
      Coincidencia exacta con el contrato:
        - Multipart form data con campo 'file' ✓
        - Validación MIME: application/pdf, image/jpeg, image/png, image/tiff ✓
        - Validación tamaño: 50MB configurable (MAX_FILE_SIZE_MB) ✓
        - Respuesta 201 con estructura exacta: file { id, name, mimeType, sizeBytes, pageCount, status, uploadedAt, expiresAt, config { size, color, sides, paper } } ✓
        - Config por defecto: A4, bw, single, normal-90 ✓
        - uploadedAt y expiresAt como timestamps Unix (segundos) ✓
        - Errores: FILE_TOO_LARGE (400), INVALID_FILE_TYPE (400) ✓
      Autenticación presente vía authMiddleware en POST /files/upload ✓
      Validación de tipo y tamaño antes de cualquier procesamiento ✓

- [x] C6 — La verificación es real
      7 tests nuevos en files.test.ts cubriendo todos los casos:
        1. Subida PDF correcta (201, respuesta completa, pageCount=3)
        2. Subida imagen JPG (201, pageCount=1)
        3. Tipo inválido → INVALID_FILE_TYPE (400)
        4. Archivo >50MB → FILE_TOO_LARGE (400)
        5. Sin autenticación → UNAUTHORIZED (401)
        6. Archivo guardado en disco con estructura correcta
        7. print_config creado con valores por defecto en DB
      Los tests prueban el endpoint real (app.request), no mocks de lógica interna.
      18/18 tests pasan (11 auth + 7 files), 87 expect() calls.

- [x] C7 — La sesión se cerró bien
      No hay archivos sin trackear sospechosos (*.tmp, node_modules fuera de lugar).
      No hay .env comiteado (solo .env.example).
      progress/current.md describe la sesión activa correctamente.
      Feature 4 en estado in_progress (correcto, pendiente de aprobación del líder).
      Build sin errores: 321 módulos, 1.0 MB.

### Tests

- Total: 18
- Pasando: 18
- Fallando: 0

### Build

- apps/api: ✓ (321 módulos, 1.0 MB, sin errores)

### Verificación del contrato de API (detalle)

| Aspecto | docs/api.md | Código (files.ts) | Match |
|---|---|---|---|
| Método | POST | POST (línea 29) | ✓ |
| Ruta | /files/upload | /upload bajo /files (index.ts línea 19) | ✓ |
| Auth | Cookie session | authMiddleware | ✓ |
| Body | multipart/form-data, campo 'file' | c.req.formData(), formData.get('file') | ✓ |
| MIME válidos | PDF, JPG, PNG, TIFF | application/pdf, image/jpeg, image/png, image/tiff | ✓ |
| Tamaño máx | 50MB | MAX_FILE_SIZE_MB (default 50) | ✓ |
| HTTP 201 | file { id, name, mimeType, sizeBytes, pageCount, status, uploadedAt, expiresAt, config } | Exactamente igual (líneas 128-148) | ✓ |
| Config default | A4, bw, single, normal-90 | A4, bw, single, normal-90 | ✓ |
| Error tamaño | FILE_TOO_LARGE | FILE_TOO_LARGE (línea 66) | ✓ |
| Error tipo | INVALID_FILE_TYPE | INVALID_FILE_TYPE (línea 53) | ✓ |

### Estructura de almacenamiento

- Esperado (feature_list.json): /storage/uploads/{user_id}/{file_id}_{filename}
- Implementado (storage.ts): {storagePath}/{userId}/{fileId}_{sanitizedFilename}
  donde storagePath default = ./storage/uploads
- Resultado: ✓ Coincide. La sanitización del filename es una mejora de seguridad.

### Problemas encontrados

Ninguno.

### Avisos (no bloqueantes)

⚠️  Aviso: La variable 'err' en el catch de la transacción DB (files.ts línea 121) se captura
    pero no se usa. Patrón aceptable, pero en el futuro podría loguearse para diagnóstico.

⚠️  Aviso: El conteo de páginas con pdf-lib tiene fallback silencioso a 1 si el PDF es
    inválido (files.ts línea 83). Decisión documentada en impl_4.md. Aceptable para V1.

### Decisión

APROBADO → el líder puede marcar la feature como done.

La implementación es sólida: contrato de API respetado al 100%, tests completos que
cubren todos los casos (incluyendo disco y DB), código limpio sin debug logs ni
archivos temporales, y arquitectura coherente con el resto del proyecto.
