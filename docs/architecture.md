# Arquitectura técnica — Cola de Impresión

---

## Visión general

Cola de Impresión es un **monorepo** con tres aplicaciones independientes y un
paquete de tipos compartidos. Cada app tiene su propio ciclo de despliegue.

```
cola-impresion/                  ← raíz del monorepo
├── apps/
│   ├── web/                     ← App cliente (SvelteKit) → Vercel
│   ├── admin/                   ← App operarios (SvelteKit) → Vercel
│   └── api/                     ← API REST (Bun + Hono) → Servidor propio
├── packages/
│   └── shared/                  ← Tipos TypeScript compartidos
├── docs/                        ← Documentación para agentes
├── progress/                    ← Estado de sesiones de trabajo
├── .opencode/                   ← Configuración de agentes opencode
├── AGENTS.md
├── CHECKPOINTS.md
├── DESIGN.md
├── feature_list.json
└── init.sh
```

---

## Stack tecnológico

| Capa | Tecnología | Razón |
|---|---|---|
| Frontend (ambas apps) | SvelteKit + TypeScript | Bundle pequeño, reactividad nativa, ideal para PWA |
| Estilos | Tailwind CSS v4 | Utilidades directas, tokens de DESIGN.md como tema |
| Gestor de paquetes | Bun | Velocidad, workspaces nativos, compatibilidad con npm |
| API | Bun + Hono | Hono es ligero, tipado con TypeScript, compatible con Bun |
| Base de datos | SQLite + Drizzle ORM | Sin servidor, backup trivial, suficiente para el volumen esperado |
| Manipulación de PDFs | pdf-lib | Librería JS madura para fusión y edición de PDFs |
| Reverse proxy | Caddy | HTTPS automático con Let's Encrypt, configuración mínima |
| Contenedores | Docker + Docker Compose | Aísla el entorno, facilita despliegue y recuperación |
| CI/CD frontend | Vercel (automático) | Push a main → despliegue automático |
| Control de versiones | Git + GitHub | |

---

## Apps en detalle

### apps/web — App cliente

**URL de producción:** `https://imprenta.tudominio.com` (o subdominio)
**Desplegada en:** Vercel
**Usuario:** clientes de la imprenta (autenticados o anónimos)

Rutas:
```
/                    → Pantalla principal (UploadZone + cola de archivos)
/auth/login          → Login
/auth/register       → Registro
/settings            → Ajustes de cuenta e historial
```

Características clave:
- PWA (Progressive Web App): instalable en móvil, funciona offline para ver la cola
- Mobile-first: diseño base para 390px, adaptaciones para 640px+
- Sin scroll global en `/`: UploadZone y cola de archivos conviven en el viewport
- Cookie de sesión persistente para usuarios autenticados
- Cookie de sesión temporal para usuarios anónimos (se pierde al cerrar navegador)

### apps/admin — App de operarios

**URL de producción:** `https://admin.imprenta.tudominio.com`
**Desplegada en:** Vercel
**Usuario:** personal de la imprenta

Rutas:
```
/                    → Lista de clientes con indicador de pendientes
/auth/login          → Login de admin (usuario/contraseña de entorno)
/clients/:id         → Detalle de cliente con archivos agrupados
```

Características clave:
- Desktop-only (no necesita ser responsive)
- Autenticación independiente: admin_user y admin_password en variables de entorno
- Vista de archivos agrupados por configuración de impresión
- Descarga de PDF combinado por grupo (generado al vuelo por la API)
- Marcado automático como impreso al descargar

### apps/api — API REST

**URL de producción:** `https://api.imprenta.tudominio.com`
**Desplegada en:** Servidor propio (Docker)
**Acceso:** Solo desde apps/web y apps/admin (CORS configurado)

Módulos:
```
src/
├── routes/
│   ├── auth.ts          → /auth/register, /auth/login, /auth/logout
│   ├── files.ts         → /files/* (subida, listado, config, borrado)
│   ├── admin.ts         → /admin/* (clientes, grupos, descarga)
│   └── session.ts       → /session/* (sesión anónima, conversión)
├── services/
│   ├── pdf-merger.ts    → Motor de agrupación y fusión de PDFs
│   ├── storage.ts       → Gestión de archivos en disco
│   └── cleanup.ts       → Job de limpieza de archivos expirados
├── db/
│   ├── schema.ts        → Schema Drizzle ORM
│   └── migrations/      → Migraciones generadas por Drizzle
├── middleware/
│   └── auth.ts          → Middleware de autenticación
└── index.ts             → Entrada de la aplicación Hono
```

### packages/shared — Tipos compartidos

Tipos TypeScript que usan tanto `apps/web` como `apps/admin` y `apps/api`:

```typescript
// Tipos de dominio
type FileStatus = 'pending' | 'printed' | 'expired'
type PrintSize = 'A4' | 'A3' | 'A5' | 'A6'
type PrintColor = 'bw' | 'color'
type PrintSides = 'single' | 'double'
type PrintPaper = 'normal-90' | 'satin-135' | 'matte-120' | 'satin-300' | 'matte-300' | 'adhesive-matte' | 'adhesive-gloss' | 'textured-300'

type PrintConfig = {
  size: PrintSize
  color: PrintColor
  sides: PrintSides
  paper: PrintPaper
}

// Payloads de API (ver docs/api.md para el contrato completo)
```

---

## Base de datos

**Motor:** SQLite (fichero en `/data/cola-impresion.db` dentro del volumen Docker)
**ORM:** Drizzle

```sql
-- Esquema simplificado

users (
  id          TEXT PRIMARY KEY,  -- UUID
  email       TEXT UNIQUE,
  password_hash TEXT,
  role        TEXT DEFAULT 'client',  -- 'client' | 'admin'
  created_at  INTEGER             -- Unix timestamp
)

files (
  id          TEXT PRIMARY KEY,  -- UUID
  user_id     TEXT,              -- NULL si es anónimo (session_id en su lugar)
  session_id  TEXT,              -- para usuarios anónimos
  filename    TEXT,
  original_name TEXT,
  storage_path TEXT,
  mime_type   TEXT,
  size_bytes  INTEGER,
  page_count  INTEGER,           -- número de páginas (PDF) o 1 (imagen)
  status      TEXT DEFAULT 'pending',  -- 'pending' | 'printed' | 'expired'
  uploaded_at INTEGER,
  expires_at  INTEGER,           -- uploaded_at + 90 días en Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id)
)

print_configs (
  id          TEXT PRIMARY KEY,
  file_id     TEXT UNIQUE,
  size        TEXT DEFAULT 'A4',
  color       TEXT DEFAULT 'bw',
  sides       TEXT DEFAULT 'single',
  paper       TEXT DEFAULT 'normal-90',
  updated_at  INTEGER,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
)

print_jobs (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT,
  group_key   TEXT,              -- hash de la combinación de parámetros
  client_id   TEXT,
  downloaded_at INTEGER,
  created_at  INTEGER,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES users(id)
)

print_job_files (
  job_id      TEXT,
  file_id     TEXT,
  PRIMARY KEY (job_id, file_id),
  FOREIGN KEY (job_id) REFERENCES print_jobs(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
)
```

---

## Almacenamiento de archivos

**Ubicación en servidor:** `/storage/uploads/` (volumen Docker persistente)

**Estructura:**
```
/storage/
└── uploads/
    ├── {user_id}/
    │   └── {file_id}_{filename_sanitized}
    └── anonymous/
        └── {session_id}/
            └── {file_id}_{filename_sanitized}
```

**Reglas:**
- Los nombres de archivo se sanitizan (sin espacios, sin caracteres especiales)
- Las rutas de almacenamiento nunca se exponen directamente al cliente
- Los archivos siempre se sirven a través de endpoints autenticados de la API
- El PDF combinado se genera al vuelo y no se persiste en disco

---

## Infraestructura de producción

Ver `docs/infrastructure.md` para el detalle completo de Docker, variables de
entorno y procedimiento de despliegue.

Esquema de red:
```
Internet
    │
    ▼
Caddy (HTTPS + reverse proxy, puerto 443)
    │
    ├── imprenta.tudominio.com    → apps/web (Vercel, externo)
    ├── admin.imprenta.tudominio.com → apps/admin (Vercel, externo)
    └── api.imprenta.tudominio.com → apps/api (Bun, puerto interno 3001)
                                         │
                                         ├── SQLite (/data/cola-impresion.db)
                                         └── Archivos (/storage/uploads/)
```

---

## Decisiones de arquitectura

**¿Por qué monorepo?**
Los tres proyectos comparten tipos TypeScript. Un monorepo con bun workspaces
permite importar `@cola-impresion/shared` desde cualquier app sin publicar en npm.

**¿Por qué SQLite y no PostgreSQL?**
El volumen esperado es de cientos de clientes y miles de archivos. SQLite maneja
esto sin problemas, el backup es copiar un fichero, y no requiere proceso separado.
La migración a PostgreSQL con Drizzle es trivial si el volumen crece.

**¿Por qué el PDF combinado se genera al vuelo?**
Los archivos originales son la fuente de verdad. Generarlo al vuelo evita tener
que sincronizar el PDF combinado cuando un cliente cambia la configuración de un
archivo. El coste de CPU es aceptable para el volumen esperado.

**¿Por qué Hono y no Express?**
Hono es más rápido, está diseñado para runtimes modernos (incluido Bun), tiene
tipado de rutas nativo y un ecosistema de middlewares adecuado para este proyecto.
