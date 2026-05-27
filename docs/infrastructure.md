# Infraestructura — Cola de Impresión

---

## Visión general

```
Internet (HTTPS)
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  Vercel (CDN global)                                │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  apps/web       │  │  apps/admin             │  │
│  │  (SvelteKit)    │  │  (SvelteKit)            │  │
│  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
      │
      │ HTTPS → api.imprenta.tudominio.com
      ▼
┌─────────────────────────────────────────────────────┐
│  Servidor Linux propio                              │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Caddy          │  │  apps/api (Bun + Hono)  │  │
│  │  (HTTPS + proxy)│  │  puerto interno: 3001   │  │
│  │  puerto: 443    │  └──────────┬──────────────┘  │
│  └────────┬────────┘             │                  │
│           │ → localhost:3001     │                  │
│           └─────────────────────┘                  │
│                                                     │
│  Volúmenes Docker persistentes:                     │
│  ├── /data/  → cola-impresion.db (SQLite)          │
│  └── /storage/ → archivos subidos por clientes     │
└─────────────────────────────────────────────────────┘
```

---

## Docker Compose

El servidor propio corre dos contenedores:

```yaml
# docker-compose.yml (en la raíz del servidor)
version: '3.9'

services:
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=/data/cola-impresion.db
      - STORAGE_PATH=/storage/uploads
      - SESSION_SECRET=${SESSION_SECRET}
      - ADMIN_USER=${ADMIN_USER}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - PORT=3001
    volumes:
      - ./data:/data          # Base de datos SQLite
      - ./storage:/storage    # Archivos de clientes
    ports:
      - "127.0.0.1:3001:3001" # Solo accesible localmente (Caddy hace el proxy)

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

---

## Caddyfile

```caddyfile
# Caddyfile
api.imprenta.tudominio.com {
    reverse_proxy localhost:3001
}
```

Caddy gestiona automáticamente:
- Certificado SSL/TLS con Let's Encrypt (renovación automática)
- Redirección HTTP → HTTPS
- Headers de seguridad básicos

Cuando las apps de Vercel estén en dominios distintos, no necesitan entrada
en el Caddyfile del servidor propio (Vercel gestiona su propio HTTPS).

---

## Dockerfile de la API

```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copiar código fuente
COPY src ./src
COPY tsconfig.json ./

# Crear directorios necesarios
RUN mkdir -p /data /storage/uploads

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
```

---

## Variables de entorno

### apps/api

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Ruta al fichero SQLite | `/data/cola-impresion.db` |
| `STORAGE_PATH` | Directorio raíz de archivos | `/storage/uploads` |
| `SESSION_SECRET` | Secreto para firmar cookies | cadena aleatoria de 32+ chars |
| `ADMIN_USER` | Usuario para el panel admin | `admin` |
| `ADMIN_PASSWORD` | Contraseña del panel admin | contraseña segura |
| `CORS_ORIGINS` | Orígenes permitidos (coma-separados) | `https://imprenta.com,https://admin.imprenta.com` |
| `PORT` | Puerto de escucha | `3001` |
| `MAX_FILE_SIZE_MB` | Tamaño máximo de archivo | `50` |
| `FILE_EXPIRY_DAYS` | Días hasta expiración de archivos | `90` |

### apps/web y apps/admin (variables de entorno de Vercel)

| Variable | Descripción |
|---|---|
| `PUBLIC_API_URL` | URL base de la API (`https://api.imprenta.tudominio.com`) |

---

## Entorno local de desarrollo

Para desarrollar localmente se levantan los servicios por separado (sin Docker):

```bash
# Terminal 1 — API
cd apps/api
cp .env.example .env   # editar con valores locales
bun install
bun run dev            # levanta en localhost:3001

# Terminal 2 — App cliente
cd apps/web
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3001
bun install
bun run dev            # levanta en localhost:5173

# Terminal 3 — App admin
cd apps/admin
cp .env.example .env   # PUBLIC_API_URL=http://localhost:3001
bun install
bun run dev            # levanta en localhost:5174
```

Para desarrollo local la base de datos se crea en `apps/api/data/cola-impresion.db`
y los archivos en `apps/api/storage/uploads/`. Ambas carpetas están en `.gitignore`.

---

## Procedimiento de despliegue

### Frontend (Vercel) — automático

1. Push a la rama `main` en GitHub.
2. Vercel detecta los cambios en `apps/web` y/o `apps/admin` y despliega automáticamente.
3. No requiere intervención manual.

Configurar en Vercel:
- Root directory: `apps/web` (para el proyecto web) y `apps/admin` (para el admin)
- Build command: `bun run build`
- Output directory: `.svelte-kit/output` (o `build` según la configuración de SvelteKit)

### Backend (servidor propio) — manual

```bash
# Conectar al servidor
ssh usuario@ip-del-servidor

# Ir al directorio del proyecto
cd /opt/cola-impresion

# Actualizar el código
git pull origin main

# Reconstruir y reiniciar el contenedor de la API
docker compose build api
docker compose up -d api

# Verificar que arrancó correctamente
docker compose logs api --tail=50
```

Para la primera vez (servidor nuevo):
```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Clonar el repositorio
git clone https://github.com/tu-usuario/cola-impresion.git /opt/cola-impresion
cd /opt/cola-impresion

# Crear el fichero .env con las variables de producción
cp .env.example .env
nano .env  # rellenar los valores reales

# Crear directorios persistentes
mkdir -p data storage/uploads

# Levantar todos los servicios
docker compose up -d

# Verificar
docker compose ps
docker compose logs
```

---

## Backup

La base de datos y los archivos son los únicos datos persistentes. El backup
consiste en copiar dos carpetas:

```bash
# Script de backup básico (ejecutar via cron diariamente)
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/cola-impresion"

mkdir -p $BACKUP_DIR

# Backup de SQLite (copia atómica)
cp /opt/cola-impresion/data/cola-impresion.db $BACKUP_DIR/db-$DATE.db

# Backup de archivos (rsync incremental)
rsync -a /opt/cola-impresion/storage/ $BACKUP_DIR/storage-$DATE/

# Eliminar backups de más de 30 días
find $BACKUP_DIR -name "db-*.db" -mtime +30 -delete
find $BACKUP_DIR -name "storage-*" -mtime +30 -type d -exec rm -rf {} +
```

---

## Monitorización básica

Para V1 no se requiere monitorización compleja. Verificar periódicamente:

```bash
# Estado de los contenedores
docker compose ps

# Logs de la API (últimas 100 líneas)
docker compose logs api --tail=100

# Espacio en disco
df -h /opt/cola-impresion/storage
du -sh /opt/cola-impresion/data/cola-impresion.db

# Archivos próximos a expirar (útil para anticipar limpieza)
# (via API o query directa a SQLite)
sqlite3 /opt/cola-impresion/data/cola-impresion.db \
  "SELECT COUNT(*) FROM files WHERE expires_at < strftime('%s','now') + 86400*7 AND status='pending';"
```
