## Implementacion feature 1: Configuracion inicial del monorepo y Docker

### Archivos creados / modificados

- `.gitignore` — Reglas de exclusion raiz (node_modules, .env, *.db, storage/, .svelte-kit/, dist/, build/, .DS_Store, *.log). NO ignora bun.lock.
- `package.json` — Raiz del monorepo con workspaces ["apps/*", "packages/*"] y scripts dev/build.
- `packages/shared/package.json` — Paquete @cola-impresion/shared, main y types apuntan a src/index.ts.
- `packages/shared/tsconfig.json` — strict true, target ESNext, module ESNext, moduleResolution bundler.
- `packages/shared/src/index.ts` — Tipos de dominio: FileStatus, PrintSize, PrintColor, PrintSides, PrintPaper, PrintConfig.
- `apps/api/package.json` — Paquete @cola-impresion/api con hono, typescript, @types/bun, y @cola-impresion/shared workspace:*.
- `apps/api/tsconfig.json` — strict true, target ESNext, paths para @cola-impresion/shared.
- `apps/api/src/index.ts` — Servidor Hono minimo con GET / que devuelve { status: "ok" }, puerto desde env o 3001.
- `apps/api/.env.example` — Variables de entorno segun docs/conventions.md.
- `apps/api/Dockerfile` — Dockerfile adaptado para monorepo (context = raiz, copia shared package).
- `docker-compose.yml` — Servicios api y caddy segun docs/infrastructure.md, con context ajustado a la raiz.
- `Caddyfile` — Reverse proxy para api.imprenta.tudominio.com -> localhost:3001.
- `apps/web/.gitkeep` — Placeholder vacio.
- `apps/admin/.gitkeep` — Placeholder vacio.

### Decisiones tomadas

- **Dockerfile adaptado para monorepo:** El Dockerfile de docs/infrastructure.md asume `context: ./apps/api` y `COPY bun.lockb`, pero bun workspaces genera el lockfile en la raiz del monorepo. Se cambio el build context a `.` (raiz) y se ajustaron las rutas COPY para incluir `packages/shared/` y `apps/api/` correctamente. El WORKDIR final es `/app/apps/api` para que el CMD funcione.
- **bun.lock en vez de bun.lockb:** Bun 1.3.10+ genera `bun.lock` (formato texto) en vez de `bun.lockb` (formato binario). Se actualizo el Dockerfile para usar `bun.lock`.
- **Bun usa export default con port:** El servidor Hono en Bun usa `export default { port, fetch: app.fetch }` en vez de `Bun.serve()` o `app.listen()`, que es el patron recomendado para Bun + Hono.

### Tests anadidos

No hay tests en esta feature (es infraestructura).

### Verificacion ejecutada

- `bun install` desde la raiz: **OK** — 12 packages installed, lockfile generado.
- `bun run dev` en apps/api: **OK** — Responde `{"status":"ok"}` en http://localhost:3001.
- `docker compose build`: **OK** — Imagen cola-impresion-api:latest construida exitosamente.
- Warnings de docker compose: variables de entorno no definidas (esperado en dev, se definen en .env para produccion). El atributo `version` es obsoleto en Docker Compose moderno (se mantiene por fidelidad a docs/infrastructure.md).

### Listo para revision: SI
