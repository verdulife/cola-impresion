import { mkdir, writeFile, unlink, rename, readdir, rmdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

function getStoragePath(): string {
  return process.env.STORAGE_PATH || './storage/uploads'
}

/**
 * Sanitiza un nombre de archivo: minúsculas, sin espacios ni caracteres especiales.
 * Solo conserva letras minúsculas, números, guiones y puntos.
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file'
}

/**
 * Guarda un archivo en disco y devuelve la ruta donde se guardó.
 * Estructura: {storagePath}/{userId}/{fileId}_{sanitizedFilename}
 */
export async function saveFile(
  userId: string,
  fileId: string,
  file: File,
): Promise<string> {
  const storagePath = getStoragePath()
  const sanitized = sanitizeFilename(file.name)
  const dir = join(storagePath, userId)
  await mkdir(dir, { recursive: true })

  const filename = `${fileId}_${sanitized}`
  const fullPath = join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)

  return fullPath
}

/**
 * Elimina un archivo del disco. No lanza error si el archivo no existe.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (existsSync(storagePath)) {
    await unlink(storagePath)
  }
}

/**
 * Guarda un archivo anónimo en disco y devuelve la ruta donde se guardó.
 * Estructura: {storagePath}/anonymous/{sessionId}/{fileId}_{sanitizedFilename}
 */
export async function saveAnonymousFile(
  sessionId: string,
  fileId: string,
  file: File,
): Promise<string> {
  const storagePath = getStoragePath()
  const sanitized = sanitizeFilename(file.name)
  const dir = join(storagePath, 'anonymous', sessionId)
  await mkdir(dir, { recursive: true })

  const filename = `${fileId}_${sanitized}`
  const fullPath = join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)

  return fullPath
}

/**
 * Mueve todos los archivos de una sesión anónima a la carpeta del usuario.
 * Devuelve un Map con las rutas antiguas → nuevas.
 * Elimina la carpeta de la sesión anónima después de mover.
 */
export async function moveAnonymousFiles(
  sessionId: string,
  userId: string,
): Promise<Map<string, string>> {
  const storagePath = getStoragePath()
  const sourceDir = join(storagePath, 'anonymous', sessionId)
  const targetDir = join(storagePath, userId)
  const moved = new Map<string, string>()

  if (!existsSync(sourceDir)) return moved

  await mkdir(targetDir, { recursive: true })

  const entries = await readdir(sourceDir)
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry)
    const targetPath = join(targetDir, entry)
    await rename(sourcePath, targetPath)
    moved.set(sourcePath, targetPath)
  }

  // Eliminar directorio vacío de la sesión anónima
  await rmdir(sourceDir)

  return moved
}
