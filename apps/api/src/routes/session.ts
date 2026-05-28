import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/index'
import { files } from '../db/schema'
import { moveAnonymousFiles } from '../services/storage'
import { removeSession } from '../middleware/auth'
import type { AppEnv } from '../middleware/auth'

const session = new Hono<AppEnv>()

/**
 * Migra todos los archivos de una sesión anónima a una cuenta de usuario.
 * - Mueve archivos físicos de anonymous/{sessionId}/ a {userId}/
 * - Actualiza storage_path, user_id y session_id en DB
 * - Elimina la sesión anónima del Map
 * Devuelve el número de archivos migrados.
 */
export async function convertAnonymousSession(
  sessionId: string,
  userId: string,
): Promise<number> {
  // Obtener todos los archivos anónimos de esta sesión
  const sessionFiles = await db
    .select()
    .from(files)
    .where(and(eq(files.sessionId, sessionId), isNull(files.userId)))

  if (sessionFiles.length === 0) {
    removeSession(sessionId)
    return 0
  }

  // Mover archivos físicos
  const movedPaths = await moveAnonymousFiles(sessionId, userId)

  // Actualizar cada archivo en DB
  for (const file of sessionFiles) {
    const newPath = movedPaths.get(file.storagePath)
    await db
      .update(files)
      .set({
        userId,
        sessionId: null,
        storagePath: newPath ?? file.storagePath,
      })
      .where(eq(files.id, file.id))
  }

  // Eliminar sesión anónima del Map
  removeSession(sessionId)

  return sessionFiles.length
}

// --- POST /session/convert ---

session.post('/convert', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body JSON inválido' },
      400,
    )
  }

  if (!body || typeof body !== 'object') {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body inválido' },
      400,
    )
  }

  const { sessionId, userId } = body as Record<string, unknown>

  if (typeof sessionId !== 'string' || typeof userId !== 'string') {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'sessionId y userId son requeridos',
      },
      400,
    )
  }

  try {
    const migratedFiles = await convertAnonymousSession(sessionId, userId)
    return c.json({ migratedFiles }, 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al convertir la sesión' },
      500,
    )
  }
})

export default session
