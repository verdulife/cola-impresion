## Implementación feature 2: Base de datos SQLite con Drizzle ORM

### Archivos creados / modificados

- `apps/api/src/db/schema.ts` — Schema Drizzle ORM con las 5 tablas: users, files, print_configs, print_jobs, print_job_files. Exporta tablas y tipos inferidos ($inferSelect / $inferInsert).
- `apps/api/src/db/index.ts` — Conexión a SQLite usando `bun:sqlite` (nativo de Bun) con Drizzle ORM. Habilita WAL mode y foreign keys. Crea el directorio `data/` si no existe.
- `apps/api/src/db/migrate.ts` — Script de migraciones. Exporta `runMigrations()` para uso programático y es ejecutable directamente con `bun run migrate`.
- `apps/api/src/db/seed.ts` — Script de seed con 2 usuarios (cliente + admin), 6 archivos y 6 configuraciones de impresión. Passwords hasheadas con `Bun.password.hash()`.
- `apps/api/src/db/migrations/0000_parallel_mulholland_black.sql` — Migración inicial generada por Drizzle Kit. Crea las 5 tablas con sus FKs e índices.
- `apps/api/src/db/migrations/meta/` — Metadatos de migraciones generados por Drizzle Kit.
- `apps/api/drizzle.config.ts` — Configuración de Drizzle Kit: schema en `src/db/schema.ts`, migraciones en `src/db/migrations/`, dialecto SQLite.
- `apps/api/src/index.ts` — Modificado: importa y ejecuta `runMigrations()` antes de arrancar el servidor Hono.
- `apps/api/package.json` — Añadidos scripts: `migrate`, `seed`, `db:generate`. Build actualizado con `--target bun` (necesario para `bun:sqlite`). Dependencias: `drizzle-orm`, `better-sqlite3` (peer dep de drizzle), `drizzle-kit`, `@types/better-sqlite3`.
- `.gitignore` — Añadido `data/` a las exclusiones existentes.

### Decisiones tomadas

- **`bun:sqlite` en vez de `better-sqlite3`:** Bun no soporta el módulo nativo `better-sqlite3` (error `ERR_DLOPEN_FAILED`). Se usa `bun:sqlite` que tiene API compatible y es nativo del runtime. Drizzle ORM tiene driver específico para `bun:sqlite` (`drizzle-orm/bun-sqlite`).
- **`better-sqlite3` se mantiene como dependencia:** Aunque no se usa directamente, `drizzle-orm` lo lista como peer dependency opcional. Se mantiene instalado para evitar warnings.
- **Build con `--target bun`:** El comando `bun build` necesita `--target bun` cuando se importan builtins de Bun como `bun:sqlite`. Sin este flag, el build falla intentando resolver el módulo como si fuera browser.
- **Migraciones automáticas al arrancar:** Se ejecutan en `src/index.ts` antes de crear la app Hono. Es idempotente (Drizzle lleva registro de migraciones aplicadas en tabla `__drizzle_migrations`).
- **Passwords del seed con `Bun.password.hash()`:** Bun incluye hashing de passwords nativo (usa bcrypt por defecto). No necesita librería externa.

### Tests añadidos

No se requieren tests para esta feature (infraestructura de DB). La verificación es funcional: migraciones aplican, seed carga datos, servidor arranca.

### Verificación ejecutada

- `bun run migrate` — ✅ Migraciones aplicadas correctamente
- `bun run seed` — ✅ 2 usuarios, 6 archivos, 6 configs creados
- `data/cola-impresion.db` — ✅ Archivo creado (verificado con Test-Path)
- Consulta directa a la DB — ✅ Datos correctos (users, files, print_configs)
- `bun run dev` — ✅ Servidor arranca y aplica migraciones automáticamente
- `bun run build` — ✅ Compila sin errores (183.49 KB, 138 módulos)

### Listo para revisión: SÍ
