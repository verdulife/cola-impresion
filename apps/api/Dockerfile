FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias (context = raíz del monorepo)
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN bun install --frozen-lockfile --production

# Copiar código fuente
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# Crear directorios necesarios
RUN mkdir -p /data /storage/uploads

EXPOSE 3001

WORKDIR /app/apps/api
CMD ["bun", "run", "src/index.ts"]
