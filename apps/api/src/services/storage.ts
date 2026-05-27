import { mkdir, writeFile, unlink } from 'fs/promises'
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
