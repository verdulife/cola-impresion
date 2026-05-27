## Revisión feature 2: Base de datos SQLite con Drizzle ORM

### Resultado: APROBADO

### Checkpoints evaluados

- [x] C1 — El arnés está completo y operativo
      Los 16 archivos base (AGENTS.md, CHECKPOINTS.md, DESIGN.md, feature_list.json,
      init.sh, progress/*, docs/*, .opencode/agents/*) existen. init.sh termina sin errores.

- [x] C2 — El estado es coherente
      Solo la feature 2 está en in_progress. La feature 1 está done (infraestructura,
      sin tests requeridos). progress/current.md describe la sesión activa correctamente.
      No hay discrepancia entre feature_list.json y el código existente.

- [x] C3 — El código respeta la arquitectura
      Todos los archivos están en apps/api (correcto). El schema en src/db/schema.ts
      define las 5 tablas (users, files, print_configs, print_jobs, print_job_files)
      con columnas, tipos, defaults y FKs que coinciden exactamente con
      docs/architecture.md. Los tipos inferidos ($inferSelect/$inferInsert) se
      exportan para las 5 tablas. No hay console.log de debug: los 8 console.log
      encontrados son todos informativos/operativos (progreso de migraciones, seed
      y arranque del servidor). No hay TODOs ni archivos temporales.

- [x] C7 — La sesión se cerró bien
      No hay archivos sospechosos (*.tmp, .env, node_modules fuera de lugar).
      progress/history.md tiene la entrada de la sesión 1 (última completada).
      La feature 2 está en in_progress (correcto, pendiente de aprobación del líder).
      Build compila sin errores (183.49 KB, 138 módulos).

### Verificación de la decisión bun:sqlite vs better-sqlite3

La decisión es **válida**. Bun no soporta módulos nativos de Node.js (como
better-sqlite3) en Windows (ERR_DLOPEN_FAILED). bun:sqlite es un módulo nativo
de Bun con API compatible, y Drizzle ORM tiene driver oficial para este caso
(drizzle-orm/bun-sqlite). El import en src/db/index.ts es correcto:
  import { Database } from 'bun:sqlite'
  import { drizzle } from 'drizzle-orm/bun-sqlite'
Verificado funcionalmente: bun:sqlite ejecuta queries correctamente en este entorno.

### Schema vs docs/architecture.md

| Tabla | Columnas | Tipos | Defaults | FKs | Índices |
|---|---|---|---|---|---|
| users | ✅ 5/5 | ✅ | ✅ role='client' | — | ✅ email UNIQUE |
| files | ✅ 12/12 | ✅ | ✅ status='pending' | ✅ user_id→users | — |
| print_configs | ✅ 7/7 | ✅ | ✅ A4/bw/single/normal-90 | ✅ file_id→files CASCADE | ✅ file_id UNIQUE |
| print_jobs | ✅ 6/6 | ✅ | — | ✅ admin_id→users, client_id→users | — |
| print_job_files | ✅ 2/2 | ✅ | — | ✅ job_id→print_jobs, file_id→files | ✅ PK compuesta |

Coincidencia exacta con el esquema definido en docs/architecture.md.

### Tests

- Total: N/A (feature de infraestructura, no requiere tests unitarios)
- Verificación funcional: migraciones aplican, seed carga datos, servidor arranca

### Build

- apps/api: ✅ (183.49 KB, 138 módulos, --target bun)

### Comandos ejecutados

| Comando | Resultado |
|---|---|
| ./init.sh | ✅ Sin errores |
| bun run migrate | ✅ Migraciones aplicadas correctamente |
| bun run seed (DB limpia) | ✅ 2 usuarios, 6 archivos, 6 configs |
| bun run seed (DB con datos) | ❌ UNIQUE constraint (esperado, ver aviso) |
| bun run build | ✅ 183.49 KB, 138 módulos |

### Avisos (no bloqueantes)

1. ⚠️  El script de seed no es idempotente: falla con UNIQUE constraint si se
    ejecuta sobre una DB que ya tiene datos. Es comportamiento estándar para un
    seed básico, pero considerar añadir limpieza previa (DELETE FROM) o usar
    INSERT OR REPLACE en iteraciones futuras para mejorar la experiencia de
    desarrollo.

2. ⚠️  better-sqlite3 está instalado como dependencia directa en package.json
    aunque no se usa (se usa bun:sqlite). El implementador documenta que es una
    peer dependency opcional de drizzle-orm. Aceptable, pero podría moverse a
    optionalDependencies o eliminarse si drizzle-orm lo permite sin warnings.

### Decisión

**APROBADO** → el líder puede marcar la feature 2 como done.

La implementación es sólida: schema fiel a la arquitectura, conexión correcta
con WAL mode y foreign keys, migraciones automáticas idempotentes al arrancar,
seed con datos de prueba razonables, y build funcional. La decisión de usar
bun:sqlite en vez de better-sqlite3 está bien justificada y verificada.
