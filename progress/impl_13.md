## Implementación feature 13: Pantalla principal con layout sin scroll global

### Archivos creados / modificados

- `apps/web/src/lib/components/UserSettingsButton.svelte` — botón fijo en esquina superior derecha con icono ⚙️, navega a /settings
- `apps/web/src/lib/components/AnonymousBanner.svelte` — banner informativo para usuarios anónimos con "Crear cuenta" y "Continuar sin cuenta"
- `apps/web/src/routes/+layout.svelte` — importa y renderiza UserSettingsButton
- `apps/web/src/routes/+page.svelte` — layout completo con UploadZone (~40vh) + FileCards con scroll interno, detección de usuario anónimo via GET /auth/me, AnonymousBanner condicional

### Decisiones tomadas

- **Layout sin scroll global**: la página usa `height: 100vh` con `overflow: hidden` en el contenedor. UploadZone tiene `flex: 0 0 auto` con `max-height: 40vh`. La lista de FileCards tiene `flex: 1` con `overflow-y: auto` interno.
- **Detección de anonymous**: se hace fetch a GET /auth/me en onMount. Si la respuesta tiene `isAnonymous: true` y no hay entrada en sessionStorage, se muestra el banner.
- **SessionStorage**: la clave `anonymous_banner_shown` se guarda cuando el usuario toca "Continuar sin cuenta", evitando mostrar el banner en recargas de la misma sesión.
- **UserSettingsButton**: posición fixed con `top: 16px; right: 16px`, 40x40px, border-radius full, fondo surface-raised con sombra sutil.

### Tests añadidos

- No hay tests unitarios para esta feature (es componente UI puro)
- Verificación manual: `bun run build` y `bun run check` pasan

### Verificación ejecutada

- `cd apps/web && bun run check` → 0 errores (solo 1 warning preexistente sobre tipos node)
- `cd apps/web && bun run build` → ✓ built in 6.65s

### Listo para revisión: SÍ