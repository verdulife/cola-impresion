import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { db } from '../db/index'
import { users, files, printConfigs, printJobs, printJobFiles } from '../db/schema'
import {
  adminAuthMiddleware,
  verifyAdminCredentials,
  createAdminSession,
  setAdminSessionCookie,
} from '../middleware/adminAuth'
import type { AdminEnv } from '../middleware/adminAuth'
import { groupFilesByConfig, generateCombinedPdf } from '../services/pdfMerger'
import type { GroupableFile } from '@cola-impresion/shared'

const admin = new Hono<AdminEnv>()

// ID del usuario admin de sistema para registrar print_jobs (FK a users)
const ADMIN_SYSTEM_ID = 'admin'

// --- POST /admin/login ---

admin.post('/login', async (c) => {
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

  const { username, password } = body as Record<string, unknown>

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Username y password son requeridos' },
      400,
    )
  }

  if (!verifyAdminCredentials(username, password)) {
    return c.json(
      { error: 'INVALID_CREDENTIALS', message: 'Credenciales de admin incorrectas' },
      401,
    )
  }

  const signedSession = await createAdminSession(username)
  setAdminSessionCookie(c, signedSession)

  return c.json({ ok: true }, 200)
})

// --- GET /admin/clients ---

admin.get('/clients', adminAuthMiddleware, async (c) => {
  try {
    // Obtener todos los usuarios con rol 'client'
    const allClients = await db
      .select()
      .from(users)
      .where(eq(users.role, 'client'))

    // Para cada cliente, contar pendientes y obtener última actividad
    const clientsWithData = await Promise.all(
      allClients.map(async (client) => {
        // Contar archivos pending
        const pendingFiles = await db
          .select()
          .from(files)
          .where(and(eq(files.userId, client.id), eq(files.status, 'pending')))

        const pendingCount = pendingFiles.length

        // Obtener última actividad (uploaded_at más reciente)
        const lastFile = await db
          .select()
          .from(files)
          .where(eq(files.userId, client.id))
          .orderBy(desc(files.uploadedAt))
          .limit(1)

        const lastActivityAt = lastFile.length > 0 ? lastFile[0].uploadedAt : client.createdAt

        return {
          id: client.id,
          email: client.email,
          pendingCount,
          lastActivityAt,
          createdAt: client.createdAt,
        }
      }),
    )

    // Ordenar: primero los que tienen pendingCount > 0, luego por lastActivityAt descendente
    clientsWithData.sort((a, b) => {
      const aHasPending = a.pendingCount > 0 ? 1 : 0
      const bHasPending = b.pendingCount > 0 ? 1 : 0
      if (aHasPending !== bHasPending) return bHasPending - aHasPending
      return b.lastActivityAt - a.lastActivityAt
    })

    return c.json({ clients: clientsWithData }, 200)
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al obtener la lista de clientes' },
      500,
    )
  }
})

// --- GET /admin/clients/:id ---

admin.get('/clients/:id', adminAuthMiddleware, async (c) => {
  const clientId = c.req.param('id')

  try {
    // Verificar que el cliente existe
    const clientRows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, clientId), eq(users.role, 'client')))

    if (clientRows.length === 0) {
      return c.json(
        { error: 'NOT_FOUND', message: 'El cliente no existe' },
        404,
      )
    }

    const client = clientRows[0]

    // Obtener archivos pending con sus configs
    const pendingRows = await db
      .select({
        file: files,
        config: printConfigs,
      })
      .from(files)
      .leftJoin(printConfigs, eq(files.id, printConfigs.fileId))
      .where(and(eq(files.userId, clientId), eq(files.status, 'pending')))

    // Convertir a GroupableFile[] para usar groupFilesByConfig
    const groupableFiles: GroupableFile[] = pendingRows.map((row) => ({
      id: row.file.id,
      name: row.file.originalName,
      storagePath: row.file.storagePath,
      pageCount: row.file.pageCount,
      config: {
        size: (row.config?.size ?? 'A4') as GroupableFile['config']['size'],
        color: (row.config?.color ?? 'bw') as GroupableFile['config']['color'],
        sides: (row.config?.sides ?? 'single') as GroupableFile['config']['sides'],
        paper: (row.config?.paper ?? 'normal-90') as GroupableFile['config']['paper'],
      },
    }))

    const groupsMap = groupFilesByConfig(groupableFiles)

    // Transformar grupos al formato de la API
    const groups = Array.from(groupsMap.values()).map((group) => {
      // Calcular nota para dúplex con páginas impares
      let note: string | undefined
      if (group.config.sides === 'double') {
        const oddCount = group.files.filter((f) => f.pageCount % 2 !== 0).length
        if (oddCount > 0) {
          const docWord = oddCount === 1 ? 'documento' : 'documentos'
          const verbForm = oddCount === 1 ? 'añadirá' : 'añadirán'
          note = `${oddCount} ${docWord} con páginas impares — se ${verbForm} ${oddCount} página${oddCount > 1 ? 's' : ''} en blanco`
        }
      }

      // Buscar uploadedAt de cada archivo en los datos originales
      const filesWithUpload = group.files.map((gf) => {
        const originalRow = pendingRows.find((r) => r.file.id === gf.id)
        return {
          id: gf.id,
          name: gf.name,
          pageCount: gf.pageCount,
          uploadedAt: originalRow?.file.uploadedAt ?? 0,
        }
      })

      return {
        groupKey: group.groupKey,
        config: group.config,
        files: filesWithUpload,
        totalPages: group.totalPages,
        ...(note ? { note } : {}),
      }
    })

    // Obtener archivos impresos (status='printed')
    const printedRows = await db
      .select({
        file: files,
        config: printConfigs,
        jobFile: printJobFiles,
        job: printJobs,
      })
      .from(files)
      .leftJoin(printConfigs, eq(files.id, printConfigs.fileId))
      .leftJoin(printJobFiles, eq(files.id, printJobFiles.fileId))
      .leftJoin(printJobs, eq(printJobFiles.jobId, printJobs.id))
      .where(and(eq(files.userId, clientId), eq(files.status, 'printed')))

    const printedFiles = printedRows.map((row) => ({
      id: row.file.id,
      name: row.file.originalName,
      config: {
        size: row.config?.size ?? 'A4',
        color: row.config?.color ?? 'bw',
        sides: row.config?.sides ?? 'single',
        paper: row.config?.paper ?? 'normal-90',
      },
      printedAt: row.job?.downloadedAt ?? row.file.uploadedAt,
    }))

    return c.json(
      {
        client: {
          id: client.id,
          email: client.email,
          createdAt: client.createdAt,
        },
        groups,
        printedFiles,
      },
      200,
    )
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al obtener el detalle del cliente' },
      500,
    )
  }
})

// --- GET /admin/clients/:id/groups/:groupKey/download ---

admin.get('/clients/:id/groups/:groupKey/download', adminAuthMiddleware, async (c) => {
  const clientId = c.req.param('id')
  const groupKey = c.req.param('groupKey')

  try {
    // Verificar que el cliente existe
    const clientRows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, clientId), eq(users.role, 'client')))

    if (clientRows.length === 0) {
      return c.json(
        { error: 'NOT_FOUND', message: 'El cliente no existe' },
        404,
      )
    }

    // Obtener archivos pending del cliente con sus configs
    const pendingRows = await db
      .select({
        file: files,
        config: printConfigs,
      })
      .from(files)
      .leftJoin(printConfigs, eq(files.id, printConfigs.fileId))
      .where(and(eq(files.userId, clientId), eq(files.status, 'pending')))

    // Agrupar archivos
    const groupableFiles: GroupableFile[] = pendingRows.map((row) => ({
      id: row.file.id,
      name: row.file.originalName,
      storagePath: row.file.storagePath,
      pageCount: row.file.pageCount,
      config: {
        size: (row.config?.size ?? 'A4') as GroupableFile['config']['size'],
        color: (row.config?.color ?? 'bw') as GroupableFile['config']['color'],
        sides: (row.config?.sides ?? 'single') as GroupableFile['config']['sides'],
        paper: (row.config?.paper ?? 'normal-90') as GroupableFile['config']['paper'],
      },
    }))

    const groupsMap = groupFilesByConfig(groupableFiles)
    const group = groupsMap.get(groupKey)

    if (!group) {
      return c.json(
        { error: 'NOT_FOUND', message: 'El grupo de impresión no existe' },
        404,
      )
    }

    // Generar PDF combinado
    const pdfBytes = await generateCombinedPdf(group)

    // Marcar todos los archivos del grupo como 'printed'
    const fileIds = group.files.map((f) => f.id)
    for (const fileId of fileIds) {
      await db
        .update(files)
        .set({ status: 'printed' })
        .where(eq(files.id, fileId))
    }

    // Registrar print_job
    const now = Math.floor(Date.now() / 1000)
    const jobId = crypto.randomUUID()

    await db.transaction(async (tx) => {
      await tx.insert(printJobs).values({
        id: jobId,
        adminId: ADMIN_SYSTEM_ID,
        groupKey,
        clientId,
        downloadedAt: now,
        createdAt: now,
      })

      // Registrar print_job_files
      for (const fileId of fileIds) {
        await tx.insert(printJobFiles).values({
          jobId,
          fileId,
        })
      }
    })

    // Devolver PDF como attachment
    return c.body(pdfBytes, 200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="grupo_${groupKey}.pdf"`,
    })
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al generar el PDF combinado' },
      500,
    )
  }
})

// --- GET /admin/files/:fileId/original ---

admin.get('/files/:fileId/original', adminAuthMiddleware, async (c) => {
  const fileId = c.req.param('fileId')

  try {
    const fileRows = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))

    if (fileRows.length === 0) {
      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo no existe' },
        404,
      )
    }

    const fileRecord = fileRows[0]

    // Verificar que el archivo existe en disco
    if (!existsSync(fileRecord.storagePath)) {
      return c.json(
        { error: 'NOT_FOUND', message: 'El archivo original no se encuentra en el servidor' },
        404,
      )
    }

    const fileData = await readFile(fileRecord.storagePath)

    return c.body(fileData, 200, {
      'Content-Type': fileRecord.mimeType,
      'Content-Disposition': `attachment; filename="${fileRecord.originalName}"`,
    })
  } catch (err) {
    return c.json(
      { error: 'INTERNAL_ERROR', message: 'Error al descargar el archivo original' },
      500,
    )
  }
})

// --- PATCH /admin/files/:fileId/status ---

const VALID_STATUSES = ['pending', 'printed'] as const

admin.patch('/files/:fileId/status', adminAuthMiddleware, async (c) => {
  const fileId = c.req.param('fileId')

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
    const fileRows = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))

    if (fileRows.length === 0) {
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
      { error: 'INTERNAL_ERROR', message: 'Error al actualizar el estado del archivo' },
      500,
    )
  }
})

export default admin
