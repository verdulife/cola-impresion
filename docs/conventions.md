# Convenciones de código — Cola de Impresión

---

## Principio general

**El código que no existe no falla.** Escribe solo lo necesario para que la
feature funcione y pase los tests. No anticipes casos de uso futuros.

---

## TypeScript

- `strict: true` en todos los `tsconfig.json`. Sin excepciones.
- No usar `any`. Si el tipo no se conoce, usar `unknown` y narrowing explícito.
- No usar `!` (non-null assertion) salvo que el contexto lo haga imposible de evitar.
- Preferir `type` sobre `interface` para tipos de datos. `interface` solo para
  contratos de objetos que se van a extender.
- Exportar tipos de dominio desde `packages/shared`. Nunca duplicarlos entre apps.
- Los tipos de respuesta de API deben coincidir exactamente con `docs/api.md`.

```typescript
// ✓ Bien
type FileStatus = 'pending' | 'printed' | 'expired'
const updateStatus = (id: string, status: FileStatus): Promise<void> => { ... }

// ✗ Mal
const updateStatus = (id: any, status: string) => { ... }
```

---

## Nombres de archivos y carpetas

| Contexto | Convención | Ejemplo |
|---|---|---|
| Componentes Svelte | PascalCase | `FileCard.svelte`, `UploadZone.svelte` |
| Rutas SvelteKit | snake_case (convención SvelteKit) | `+page.svelte`, `+page.server.ts` |
| Servicios y utilidades | camelCase | `pdfMerger.ts`, `fileStorage.ts` |
| Tipos compartidos | camelCase | `printConfig.ts`, `fileTypes.ts` |
| Tests | mismo nombre + `.test.ts` | `pdfMerger.test.ts` |
| Variables de entorno | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `STORAGE_PATH` |

---

## Estructura interna de una app SvelteKit

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── components/      ← Componentes reutilizables (.svelte)
│   │   ├── stores/          ← Stores de Svelte (estado global)
│   │   ├── utils/           ← Funciones puras de utilidad
│   │   └── api.ts           ← Funciones para llamar a la API
│   ├── routes/
│   │   ├── +layout.svelte   ← Layout global
│   │   ├── +page.svelte     ← Pantalla principal
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── settings/
│   └── app.html
├── static/
├── package.json
├── svelte.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Componentes Svelte

- Un componente por archivo. Sin excepciones.
- Los props se tipan explícitamente con `export let`:
  ```svelte
  <script lang="ts">
    import type { PrintConfig } from '@cola-impresion/shared'
    export let config: PrintConfig
    export let onUpdate: (config: PrintConfig) => void
  </script>
  ```
- No usar lógica de negocio en componentes. La lógica va en `+page.server.ts`
  (para operaciones del servidor) o en stores (para estado de cliente).
- Los eventos del DOM se manejan con funciones nombradas, no inline:
  ```svelte
  <!-- ✓ Bien -->
  <button on:click={handleUpload}>Subir</button>

  <!-- ✗ Mal -->
  <button on:click={() => { /* lógica larga */ }}>Subir</button>
  ```

---

## Tailwind CSS

- Usar solo las clases de utilidad de Tailwind. Sin CSS personalizado salvo en
  casos absolutamente justificados.
- Los valores de color, tipografía y espaciado vienen de los tokens de `DESIGN.md`,
  configurados como tema personalizado en `tailwind.config.js`.
- No hardcodear valores: usar `text-primary` (del tema), no `text-[#1A1A2E]`.
- Orden de clases: layout → spacing → sizing → typography → color → state:
  ```html
  <!-- ✓ Orden correcto -->
  <div class="flex flex-col gap-3 p-4 w-full rounded-lg bg-surface border border-border hover:bg-surface-raised">
  ```

---

## API (Hono + Bun)

- Cada módulo de rutas en su propio archivo en `src/routes/`.
- Registrar todas las rutas en `src/index.ts` con prefijo de módulo:
  ```typescript
  app.route('/auth', authRoutes)
  app.route('/files', fileRoutes)
  app.route('/admin', adminRoutes)
  ```
- Los handlers son funciones async. Siempre manejar errores con try/catch.
- Respuestas de error siempre con estructura consistente:
  ```typescript
  // ✓ Estructura de error estándar
  return c.json({ error: 'FILE_NOT_FOUND', message: 'El archivo no existe' }, 404)
  ```
- Los códigos de error son strings en SCREAMING_SNAKE_CASE.
- No devolver stack traces en producción. El mensaje es para el usuario, el log
  es para el desarrollador.

---

## Base de datos (Drizzle)

- Las queries van en el handler de la ruta o en un servicio dedicado, nunca
  en un componente de frontend.
- Usar transacciones para operaciones que modifican más de una tabla:
  ```typescript
  await db.transaction(async (tx) => {
    await tx.insert(files).values(...)
    await tx.insert(printConfigs).values(...)
  })
  ```
- No usar queries raw salvo que Drizzle no soporte la operación.
- Los IDs son UUIDs generados con `crypto.randomUUID()`.

---

## Variables de entorno

Cada app tiene su propio `.env` (no comiteado) y `.env.example` (comiteado):

```bash
# apps/api/.env.example
DATABASE_URL=./data/cola-impresion.db
STORAGE_PATH=./storage/uploads
SESSION_SECRET=cambiar_en_produccion
ADMIN_USER=admin
ADMIN_PASSWORD=cambiar_en_produccion
CORS_ORIGINS=https://imprenta.tudominio.com,https://admin.imprenta.tudominio.com
PORT=3001
```

Reglas:
- **Nunca** comitear `.env` con valores reales.
- Siempre tener `.env.example` actualizado.
- Acceder a variables de entorno solo en el servidor, nunca en el cliente.

---

## Tests

- Framework: `bun test` (nativo, sin configuración extra).
- Un fichero de test por módulo de servicio.
- Los tests de la API usan el servidor real levantado en modo test, no mocks.
- Los tests del motor de PDFs usan archivos PDF reales de `tests/fixtures/`.
- Nombrar los tests en español para que sean legibles:
  ```typescript
  test('agrupa correctamente archivos con la misma configuración', () => { ... })
  test('añade página en blanco a documentos impares en modo dúplex', () => { ... })
  ```
- Cada test es independiente: no depende del orden de ejecución.

---

## Git

- Commits en español, imperativo, descriptivo:
  ```
  ✓ "Añadir endpoint de subida de archivos"
  ✗ "fix", "wip", "cambios", "update"
  ```
- Una feature = una rama = un conjunto de commits coherente.
- No comitear `node_modules`, `.env`, archivos `.db`, ni la carpeta `storage/`.
- El `.gitignore` de la raíz cubre todo el monorepo.
