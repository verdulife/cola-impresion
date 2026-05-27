import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { files, printConfigs } from '../db/schema'
import type { AppEnv } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'
import { saveFile, deleteFile } from '../services/storage'
import { PDFDocument } from 'pdf-lib'

const filesRoute = new Hono<AppEnv>()

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
]

const VALID_SIZES = ['A4', 'A3', 'A5', 'A6'] as const
const VALID_COLORS = ['bw', 'color'] as const
const VALID_SIDES = ['single', 'double'] as const
const VALID_PAPERS = [
  'normal-90',
  'satin-135',
  'matte-120',
  'satin-300',
  'matte-300',
  'adhesive-matte',
  'adhesive-gloss',
  'textured-300',
] as const
const VALID_STATUSES = ['pending', 'printed'] as const

type FileWithConfig = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  pageCount: number
  status: string
  uploadedAt: number
  expiresAt: number
  config: {
    size: string
    color: string
    sides: string
    paper: string
  }
}

function toFileResponse(
  file: typeof files.$inferSelect,
  config: typeof printConfigs.$inferSelect | null,
): FileWithConfig {
  return {
    id: file.id,
    name: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    pageCount: file.pageCount,
    status: file.status,
    uploadedAt: file.uploadedAt,
    expiresAt: file.expiresAt,
    config: {
      size: config?.size ?? 'A4',
      color: config?.color ?? 'bw',
      sides: config?.sides ?? 'single',
      paper: config?.paper ?? 'normal-90',
    },
  }
}

function getMaxFileSizeBytes(): number {
  const mb = Number(process.env.MAX_FILE_SIZE_MB) || 50
  return mb * 1024 * 1024
}

function getFileExpiryDays(): number {
  return Number(process.env.FILE_EXPIRY_DAYS) || 90
}

// --- POST /files/upload ---

filesRoute.post('/upload', authMiddleware, async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Formato multipart inválido' },
      400,
    )
  }

  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'No se proporcionó ningún archivo' },
      400,
    )
  }

  // Validar tipo MIME
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json(
      {
        error: 'INVALID_FILE_TYPE',
        message: 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG y TIFF.',
      },
      400,
    )
  }

  // Validar tamaño
  const maxBytes = getMaxFileSizeBytes()
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024))
    return c.json(
      {
        error: 'FILE_TOO_LARGE',
        message: `El archivo supera el límite de ${maxMb}MB.`,
      },
      400,
    )
  }

  const userId = c.get('userId')
  const fileId = crypto.randomUUID()

  // Contar páginas
  let pageCount = 1
  if (file.type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      pageCount = pdfDoc.getPageCount()
    } catch {
      pageCount = 1
    }
  }

  // Guardar archivo en disco
  const storagePath = await saveFile(userId, fileId, file)

  const uploadedAt = Math.floor(Date.now() / 1000)
  const expiresAt = uploadedAt + getFileExpiryDays() * 24 * 60 * 60

  // Insertar en DB con transacción
  try {
    await db.transaction(async (tx) => {
      await tx.insert(files).values({
        id: fileId,
        userId,
        filename: file.name,
        originalName: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        pageCount,
        status: 'pending',
        uploadedAt,
        expiresAt,
      })

      await tx.insert(printConfigs).values({
        id: crypto.randomUUID(),
        fileId,
        size: 'A4',
        color: 'bw',
        sides: 'single',
        paper: 'normal-90',
        updatedAt: uploadedAt,
      })
    })
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al registrar el archivo' },
      500,
    )
  }

  return c.json(
    {
      file: {
        id: fileId,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        pageCount,
        status: 'pending',
        uploadedAt,
        expiresAt,
        config: {
          size: 'A4',
          color: 'bw',
          sides: 'single',
          paper: 'normal-90',
        },
      },
    },
    201,
  )
})

// --- GET /files ---

filesRoute.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const statusFilter = c.req.query('status')

  // Validar filtro de status si se proporciona
  if (statusFilter && !VALID_STATUSES.includes(statusFilter as typeof VALID_STATUSES[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Status no válido. Use "pending" o "printed".' },
      400,
    )
  }

  try {
    let query = db
      .select({
        file: files,
        config: printConfigs,
      })
      .from(files)
      .leftJoin(printConfigs, eq(files.id, printConfigs.fileId))
      .where(eq(files.userId, userId))

    const rows = await query

    // Filtrar por status en memoria si se proporcionó
    const filtered = statusFilter
      ? rows.filter((r) => r.file.status === statusFilter)
      : rows

    const result = filtered.map((row) => toFileResponse(row.file, row.config))

    return c.json({ files: result }, 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al obtener los archivos' },
      500,
    )
  }
})

// --- GET /files/:id ---

filesRoute.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  try {
    const rows = await db
      .select({
        file: files,
        config: printConfigs,
      })
      .from(files)
      .leftJoin(printConfigs, eq(files.id, printConfigs.fileId))
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))

    if (rows.length === 0) {
      // Verificar si el archivo existe pero pertenece a otro usuario
      const existingFile = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))

      if (existingFile.length > 0) {
        return c.json(
          { error: 'FORBIDDEN', message: 'No tienes permiso para acceder a este archivo' },
          403,
        )
      }

      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo no existe' },
        404,
      )
    }

    const row = rows[0]
    return c.json(toFileResponse(row.file, row.config), 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al obtener el archivo' },
      500,
    )
  }
})

// --- PATCH /files/:id/config ---

filesRoute.patch('/:id/config', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body JSON inválido' },
      400,
    )
  }

  // Validar valores si están presentes
  if (body.size !== undefined && !VALID_SIZES.includes(body.size as typeof VALID_SIZES[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: `Valor de size no válido. Use: ${VALID_SIZES.join(', ')}` },
      400,
    )
  }
  if (body.color !== undefined && !VALID_COLORS.includes(body.color as typeof VALID_COLORS[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: `Valor de color no válido. Use: ${VALID_COLORS.join(', ')}` },
      400,
    )
  }
  if (body.sides !== undefined && !VALID_SIDES.includes(body.sides as typeof VALID_SIDES[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: `Valor de sides no válido. Use: ${VALID_SIDES.join(', ')}` },
      400,
    )
  }
  if (body.paper !== undefined && !VALID_PAPERS.includes(body.paper as typeof VALID_PAPERS[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: `Valor de paper no válido. Use: ${VALID_PAPERS.join(', ')}` },
      400,
    )
  }

  try {
    // Verificar que el archivo existe y pertenece al usuario
    const existingFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))

    if (existingFiles.length === 0) {
      const anyFile = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))

      if (anyFile.length > 0) {
        return c.json(
          { error: 'FORBIDDEN', message: 'No tienes permiso para modificar este archivo' },
          403,
        )
      }

      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo no existe' },
        404,
      )
    }

    // Construir objeto de update parcial
    const updateData: Record<string, unknown> = {
      updatedAt: Math.floor(Date.now() / 1000),
    }
    if (body.size !== undefined) updateData.size = body.size
    if (body.color !== undefined) updateData.color = body.color
    if (body.sides !== undefined) updateData.sides = body.sides
    if (body.paper !== undefined) updateData.paper = body.paper

    await db
      .update(printConfigs)
      .set(updateData)
      .where(eq(printConfigs.fileId, fileId))

    // Obtener config actualizada para devolverla
    const updatedConfigs = await db
      .select()
      .from(printConfigs)
      .where(eq(printConfigs.fileId, fileId))

    const config = updatedConfigs[0]

    return c.json(
      {
        config: {
          size: config.size,
          color: config.color,
          sides: config.sides,
          paper: config.paper,
        },
      },
      200,
    )
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al actualizar la configuración' },
      500,
    )
  }
})

// --- PATCH /files/:id/status ---

filesRoute.patch('/:id/status', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body JSON inválido' },
      400,
    )
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: `Status no válido. Use: ${VALID_STATUSES.join(', ')}` },
      400,
    )
  }

  try {
    // Verificar que el archivo existe y pertenece al usuario
    const existingFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))

    if (existingFiles.length === 0) {
      const anyFile = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))

      if (anyFile.length > 0) {
        return c.json(
          { error: 'FORBIDDEN', message: 'No tienes permiso para modificar este archivo' },
          403,
        )
      }

      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo no existe' },
        404,
      )
    }

    await db
      .update(files)
      .set({ status: body.status as string })
      .where(eq(files.id, fileId))

    return c.json({ ok: true }, 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al actualizar el estado' },
      500,
    )
  }
})

// --- DELETE /files/:id ---

filesRoute.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  try {
    // Verificar que el archivo existe y pertenece al usuario
    const existingFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))

    if (existingFiles.length === 0) {
      const anyFile = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))

      if (anyFile.length > 0) {
        return c.json(
          { error: 'FORBIDDEN', message: 'No tienes permiso para eliminar este archivo' },
          403,
        )
      }

      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo no existe' },
        404,
      )
    }

    const fileRecord = existingFiles[0]

    // Eliminar archivo físico del disco
    await deleteFile(fileRecord.storagePath)

    // Eliminar registro de DB (print_configs se elimina por CASCADE)
    await db.delete(files).where(eq(files.id, fileId))

    return c.json({ ok: true }, 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al eliminar el archivo' },
      500,
    )
  }
})

export default filesRoute
