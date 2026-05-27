import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import * as schema from './schema'

const dbUrl = process.env.DATABASE_URL || './data/cola-impresion.db'

// Asegurar que el directorio de la base de datos existe (solo para fichero en disco)
if (dbUrl !== ':memory:') {
  const dbDir = dirname(dbUrl)
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbUrl)

// Habilitar WAL mode para mejor concurrencia y foreign keys
sqlite.exec('PRAGMA journal_mode = WAL')
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
