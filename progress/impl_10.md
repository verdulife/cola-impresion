## Implementación feature 10: Pantallas de login y registro

### Archivos creados / modificados

- `apps/web/src/routes/auth/login/+page.svelte` — Formulario de login con validación en cliente
- `apps/web/src/routes/auth/login/+page.server.ts` — Action que hace POST a `/auth/login` de la API
- `apps/web/src/routes/auth/register/+page.svelte` — Formulario de registro con validación en cliente
- `apps/web/src/routes/auth/register/+page.server.ts` — Action que hace POST a `/auth/register` de la API

### Decisiones tomadas

- **Uso de SvelteKit form actions**: El formulario usa `use:enhance` de SvelteKit para validación progresiva. La validación en cliente se ejecuta antes de enviar el formulario, y el servidor valida de nuevo antes de llamar a la API.
- **Credenciales en cookies**: Se usa `credentials: 'include'` en el fetch para que la cookie de sesión se guarde automáticamente. La API ya establece la cookie HttpOnly.
- **Tokens CSS de app.css**: Los estilos usan las clases generadas por los tokens de DESIGN.md (`text-h1`, `text-body`, `text-caption`, `text-error`, `bg-surface`, `bg-surface-raised`, `border-border`, `rounded-md`, `focus:ring-accent`, etc.).
- **Errores inline**: Siguiendo las reglas de UX en `docs/ux.md`, los errores de validación aparecen debajo del campo en texto pequeño rojo (`text-caption text-error`). Los errores del servidor también se muestran inline.
- **Accesibilidad**: Los inputs tienen `aria-invalid`, `aria-describedby` y labels asociados correctamente.
- **Redirección en éxito**: El action del servidor lanza `redirect(303, '/')` al tener éxito, lo que lleva al usuario a la pantalla principal.

### Tests añadidos

No hay tests para esta feature (frontend UI sin lógica compleja). La verificación es manual.

### Verificación ejecutada

- `cd apps/web && bun run build` → **PASÓ** (✓ built in 6.21s)
- `cd apps/web && bun run check` → **PASÓ** (0 errores, 1 warning no relacionado con el código)

### Listo para revisión: SÍ