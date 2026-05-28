## Revisión feature 10: Pantallas de login y registro

### Resultado: APROBADO

### Checkpoints evaluados

- [x] C1 — El arnés está completo y operativo
      (No aplica directamente a esta feature — verificado en sesión anterior)

- [x] C2 — El estado es coherente
      Feature 10 en `feature_list.json` con status `pending` ✓
      No hay más de una feature en `in_progress` ✓

- [x] C3 — El código respeta la arquitectura
      - Archivos en `apps/web/src/routes/auth/` (correcto) ✓
      - No hay lógica de negocio en componentes UI (validación en cliente + server action) ✓
      - No hay llamadas directas a DB desde frontend ✓
      - No hay `console.log` de debug ✓
      - No hay TODOs sin contexto ✓

- [x] C4 — El código respeta el diseño
      - Todos los colores usan tokens Tailwind del tema: `bg-surface`, `text-text-primary`,
        `border-border`, `text-error`, `text-accent`, `text-accent-hover`, `text-text-secondary`,
        `text-text-disabled`, `text-text-on-accent` ✓
      - No hay valores hardcodeados de color (#hex) en los archivos .svelte ✓
      - Tipografía usa clases del tema: `text-h1`, `text-body`, `text-body-small`,
        `text-label`, `text-caption` ✓
      - Espaciado y bordes usan clases del tema: `rounded-md`, `gap-5`, `gap-1.5` ✓

- [x] C5 — El contrato de API se respeta
      - Login: POST `${PUBLIC_API_URL}/auth/login` con `{email, password}` en JSON ✓
      - Register: POST `${PUBLIC_API_URL}/auth/register` con `{email, password}` en JSON ✓
      - `credentials: '"'"'include'"'"'` en ambos para enviar/recibir cookies HttpOnly ✓
      - Errores de API devueltos inline como `form.error` (no toast) ✓
      - Redirección a `/` tras éxito (redirect 303) ✓

- [x] C6 — La verificación es real
      - Build: `cd apps/web && bun run build` → ✓ pasa (built in 5.74s)
      - Type check: `cd apps/web && bun run check` → ✓ pasa (0 errores, 1 warning preexistente
        sobre tipos de node, no relacionado con esta feature)

- [x] C7 — La sesión se cerró bien
      - Build pasa en apps/web ✓
      - feature_list.json actualizado correctamente ✓

### Detalle de validación

#### Formularios y validación en cliente
- Login: `handleSubmit()` valida email (regex) y password (no vacío) antes de enviar ✓
- Register: `handleSubmit()` valida email (regex), password (no vacío, mínimo 8 chars) ✓
- El `use:enhance` cancela el envío si la validación falla (retorna no-op function) ✓
- El botón se deshabilita con `disabled={isSubmitting}` durante el envío ✓

#### Errores inline (no toast)
- Errores de validación de campo: `<p class="text-caption text-error">` debajo de cada input ✓
- Error de servidor (credenciales inválidas, email en uso): `{#if form?.error}` con clase
  `text-error` inline en el formulario, no toast ✓
- Errores de red: `catch` en server action devuelve `fail(500, {error: "..."})` mostrado
  inline ✓

#### Redirecciones
- Login exitoso: `throw redirect(303, '"'"'/'"'"')` ✓
- Register exitoso: `throw redirect(303, '"'"'/'"'"')` ✓

#### Enlaces entre login y register
- Login page: "¿No tienes cuenta? [Crear cuenta](/auth/register)" ✓
- Register page: "¿Ya tienes cuenta? [Iniciar sesión](/auth/login)" ✓

#### Accesibilidad
- Inputs con `<label>` asociado ✓
- `aria-invalid` dinámico según haya error ✓
- `aria-describedby` apunta al id del mensaje de error ✓
- `autocomplete` correcto: `email`, `current-password` (login), `new-password` (register) ✓

#### UX docs (docs/ux.md líneas 106-143)
- Register: POST /auth/register → redirect a / ✓
- Login: POST /auth/login → redirect a / ✓
- Errores inline (no toast) ✓
- Enlace entre pantallas ✓

### Tests

No hay tests unitarios para esta feature (UI frontend sin lógica compleja).
La verificación es mediante build + type check, ambos pasando.

### Problemas encontrados

Ninguno.

### Avisos (no bloquean)

1. ⚠️ El implementador reporta "No hay tests para esta feature (frontend UI sin lógica
   compleja)". Esto es aceptable para UI pura, pero si en el futuro se añade lógica
   (ej. rate limiting, token refresh), debería cubrirse con tests.

### Decisión

**APROBADO** — El líder puede marcar la feature 10 como `done` en `feature_list.json`.
