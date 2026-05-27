# Verificación — Cómo demostrar que una feature funciona

> Una feature no está `done` hasta que pasa todos los puntos de verificación
> aplicables a su capa. El agente implementador ejecuta esta lista antes de
> pasarle el trabajo al revisor.

---

## Verificación de infraestructura (features de layer: infrastructure)

- [ ] `docker compose build` termina sin errores.
- [ ] `docker compose up -d` levanta todos los servicios.
- [ ] `docker compose ps` muestra todos los contenedores en estado `running`.
- [ ] La API responde en `http://localhost:3001/health` con `{ "ok": true }`.
- [ ] Los volúmenes `/data` y `/storage` existen y tienen permisos de escritura.
- [ ] `./init.sh` termina con exit code 0.

---

## Verificación de backend (features de layer: backend)

### Antes de implementar
- [ ] He leído `docs/api.md` y conozco el contrato exacto del endpoint a implementar.
- [ ] He leído `docs/architecture.md` para saber en qué módulo va el código.

### Durante la implementación
- [ ] El endpoint está documentado en `docs/api.md` (si es nuevo).
- [ ] El handler tiene manejo de errores con try/catch.
- [ ] Los errores devuelven la estructura estándar `{ error, message }`.
- [ ] Las rutas protegidas usan el middleware de autenticación.

### Tests obligatorios para backend
Cada endpoint nuevo debe tener al minimum estos tests:

```typescript
// Patrón de test para endpoints de la API
test('POST /auth/register — crea usuario y devuelve 201', async () => { ... })
test('POST /auth/register — devuelve 409 si el email ya existe', async () => { ... })
test('POST /auth/register — devuelve 400 si la contraseña es < 8 chars', async () => { ... })
```

Tests específicos para el motor de PDF (feature 6):
```typescript
test('agrupa archivos con la misma configuración en un único grupo', async () => { ... })
test('archivos con distinta configuración quedan en grupos separados', async () => { ... })
test('inserta página en blanco en documentos PDF de páginas impares (modo dúplex)', async () => { ... })
test('no inserta página en blanco en documentos de páginas pares (modo dúplex)', async () => { ... })
test('no inserta página en blanco en modo simplex (1 cara)', async () => { ... })
test('el PDF combinado tiene las páginas en el orden correcto', async () => { ... })
test('el PDF combinado tiene el número de páginas correcto', async () => { ... })
```

### Verificación manual del endpoint
```bash
# Ejemplo: verificar POST /auth/register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  -c /tmp/cookies.txt

# Verificar que la cookie se estableció
cat /tmp/cookies.txt
```

---

## Verificación de frontend — App cliente (features de layer: frontend, app: web)

### Antes de implementar
- [ ] He leído `DESIGN.md` completamente.
- [ ] He leído la sección relevante de `docs/ux.md`.
- [ ] Conozco el endpoint de la API que usa esta feature (en `docs/api.md`).

### Checklist visual (verificar en Chrome DevTools mobile — iPhone 14, 390px)
- [ ] La pantalla principal no tiene scroll global (UploadZone + cola caben en el viewport).
- [ ] La UploadZone tiene aspect-ratio 1:1 y ocupa el 100% del ancho.
- [ ] Los colores usados están en la paleta de `DESIGN.md` (no hay valores hardcodeados).
- [ ] La tipografía usa las clases de Tailwind del tema (no `text-[#...]`).
- [ ] Los estados de error son visibles y descriptivos.
- [ ] Los botones tienen tamaño mínimo de toque de 44×44px (estándar iOS).

### Checklist funcional
- [ ] El flujo descrito en `docs/ux.md` para esta feature funciona exactamente como se describe.
- [ ] El AnonymousBanner solo aparece una vez por sesión.
- [ ] La configuración se guarda automáticamente sin botón de confirmar.
- [ ] La cola de archivos tiene scroll interno propio (no scroll de página).
- [ ] El UserSettingsButton es visible y navega a /settings.

### Build check
```bash
cd apps/web
bun run build   # debe terminar sin errores ni warnings de TypeScript
```

---

## Verificación de frontend — App admin (features de layer: frontend, app: admin)

### Checklist funcional
- [ ] El login con credenciales incorrectas muestra error.
- [ ] El login con credenciales correctas redirige a la lista de clientes.
- [ ] Los clientes con pendientes aparecen primero en la lista.
- [ ] El badge de pendientes muestra el número correcto.
- [ ] La búsqueda filtra en tiempo real por nombre o email.
- [ ] Al descargar el PDF combinado, los archivos se marcan como impresos.
- [ ] Los archivos marcados como impresos aparecen en la sección "Ya impresos".
- [ ] El botón "Reimprimir" cambia el estado de nuevo a pendiente.

### Build check
```bash
cd apps/admin
bun run build   # debe terminar sin errores ni warnings de TypeScript
```

---

## Verificación del motor de agrupación (feature 6 — caso crítico)

El motor de agrupación es la pieza más compleja del sistema. Verificar
con estos casos concretos usando archivos reales en `tests/fixtures/`:

| Caso | Archivos | Configuración | Resultado esperado |
|---|---|---|---|
| Agrupación básica | doc1.pdf (4p), doc2.pdf (6p) | A4, B/N, 1 cara | 1 grupo, PDF de 10 páginas |
| Grupos separados | doc1.pdf, foto.jpg | doc1: A4 B/N, foto: A4 Color | 2 grupos, 1 PDF cada uno |
| Dúplex par | doc1.pdf (4p), doc2.pdf (6p) | A4, B/N, 2 caras | 1 grupo, PDF de 10 páginas, sin blancos añadidos |
| Dúplex impar | doc1.pdf (3p), doc2.pdf (5p) | A4, B/N, 2 caras | 1 grupo, PDF de 10 páginas (3+1 blanco + 5+1 blanco) |
| Dúplex mixto | doc1.pdf (4p), doc2.pdf (5p) | A4, B/N, 2 caras | 1 grupo, PDF de 10 páginas (4 + 5+1 blanco) |

```bash
# Ejecutar todos los tests del motor de PDF
cd apps/api
bun test src/services/pdf-merger.test.ts --verbose
```

---

## Verificación final antes de cerrar sesión

```bash
# Desde la raíz del monorepo
./init.sh

# Si hay apps con código nuevo, compilar todas
cd apps/api && bun run build && cd ../..
cd apps/web && bun run build && cd ../..
cd apps/admin && bun run build && cd ../..

# Ejecutar todos los tests disponibles
cd apps/api && bun test && cd ../..
```

Todo verde → se puede marcar la feature como `done` en `feature_list.json`
y cerrar la sesión siguiendo el protocolo de `AGENTS.md §6`.
