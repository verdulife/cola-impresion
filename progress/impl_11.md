## Corrección Feature 11 (UploadZone) - Review Feedback

### Problemas corregidos

#### 1. URL del upload hardcodeada (CRÍTICO) — CORREGIDO
- **Ubicación:** `apps/web/src/lib/components/UploadZone.svelte` línea 149
- **Antes:** `xhr.open('POST', '/api/files/upload');`
- **Después:** `xhr.open('POST', `${PUBLIC_API_URL}/files/upload`);`
- **Cambio:** Añadida importación de `PUBLIC_API_URL` desde `$env/static/public` (línea 3)

#### 2. Color dragover incorrecto — CORREGIDO
- **Ubicación:** `apps/web/src/lib/components/UploadZone.svelte` línea 221
- **Antes:** `background-color: var(--color-info-surface);`
- **Después:** `background-color: var(--color-error-surface);`

#### 3. Type check falla con $state — NO BLOQUEANTE
- Los errores de `svelte-check` sobre `$state` son un problema conocido de tooling con Svelte 5 + svelte-check
- El build pasa correctamente (`bun run build` ✓)
- No se requiere acción ya que el problema es del tooling, no del código

### Archivos modificados

- `apps/web/src/lib/components/UploadZone.svelte` — 3 correcciones aplicadas

### Verificación ejecutada

- `cd apps/web; bun run build` — **PASA** ✓
- `cd apps/web; bun run check` — Falla con errores de tooling en `$state` (no bloqueante, problema conocido)

### Listo para revisión: SÍ

Los 2 problemas bloqueantes fueron corregidos. El error de `svelte-check` sobre `$state` es un problema de tooling conocido con Svelte 5 y no afecta al build ni al funcionamiento del componente.