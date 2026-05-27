import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './index'

export function runMigrations(): void {
  console.log('Aplicando migraciones...')
  migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migraciones aplicadas correctamente.')
}

// Ejecución directa: bun run src/db/migrate.ts
if (import.meta.main) {
  runMigrations()
  process.exit(0)
}
