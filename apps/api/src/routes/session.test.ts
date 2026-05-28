import { describe, test, expect, beforeEach } from 'bun:test'
import { PDFDocument } from 'pdf-lib'
import { existsSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'

// Configurar entorno de test ANTES de importar módulos que dependen de env
process.env.DATABASE_URL = ':memory:'
process.env.SESSION_SECRET = 'test-secret-for-session-tests'
process.env.STORAGE_PATH = './storage/test-session-uploads'
process.env.MAX_FILE_SIZE_MB = '50'
process.env.FILE_EXPIRY_DAYS = '90'

// Imports dinámicos después de configurar env
const { app } = await import('../index')
const { db } = await import('../db/index')
const { users, files, printConfigs } = await import('../db/schema')
const { clearSessions } = await import('../middleware/auth')

const TEST_STORAGE_PATH = './storage/test-session-uploads'

// --- Helpers ---

function extractSessionCookie(response: Response): string | null {
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []
  for (const header of setCookieHeaders) {
    if (header.startsWith('session=')) {
      const value = header.split(';')[0].replace('session=', '')
      return value || null
    }
  }
  return null
}

async function createTestPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595, 842])
  }
  return await doc.save()
}

async function uploadAnonymousPdf(
  name: string = 'anon-doc.pdf',
  pages: number = 2,
): Promise<{ fileId: string; cookie: string; res: Response }> {
  const pdfBytes = await createTestPdf(pages)
  const file = new File([pdfBytes], name, { type: 'application/pdf' })

  const formData = new FormData()
  formData.append('file', file)

  const res = await app.request('/files/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  const cookie = extractSessionCookie(res)
  if (!cookie) throw new Error('No se obtuvo cookie de sesión anónima')

  return { fileId: data.file.id, cookie, res }
}

async function registerUser(
  email: string,
  password: string,
  cookie?: string,
): Promise<{ userId: string; cookie: string; res: Response }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cookie) {
    headers['Cookie'] = `session=${cookie}`
  }

  const res = await app.request('/auth/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json()
  const newCookie = extractSessionCookie(res)
  if (!newCookie) throw new Error('No se obtuvo cookie de sesión')

  return { userId: data.user.id, cookie: newCookie, res }
}

async function getAnonymousSessionId(cookie: string): Promise<string> {
  const res = await app.request('/auth/me', {
    headers: { Cookie: `session=${cookie}` },
  })
  const data = await res.json()
  if (!data.sessionId) throw new Error('No se obtuvo sessionId de /auth/me')
  return data.sessionId
}

// --- Setup / Teardown ---

beforeEach(async () => {
  await db.delete(printConfigs)
  await db.delete(files)
  await db.delete(users)
  clearSessions()

  if (existsSync(TEST_STORAGE_PATH)) {
    rmSync(TEST_STORAGE_PATH, { recursive: true, force: true })
  }
})

// --- Tests ---

describe('Sesión anónima — subida de archivos', () => {
  test('POST /files/upload — usuario anónimo sube archivo sin autenticación', async () => {
    const pdfBytes = await createTestPdf(3)
    const file = new File([pdfBytes], 'anon-test.pdf', {
      type: 'application/pdf',
    })

    const formData = new FormData()
    formData.append('file', file)

    const res = await app.request('/files/upload', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.file).toBeDefined()
    expect(data.file.id).toBeDefined()
    expect(data.file.name).toBe('anon-test.pdf')
    expect(data.file.pageCount).toBe(3)
    expect(data.file.status).toBe('pending')

    // Verificar que se estableció cookie de sesión
    const cookie = extractSessionCookie(res)
    expect(cookie).not.toBeNull()
  })

  test('POST /files/upload — archivo anónimo se guarda en storage/anonymous/{session_id}/', async () => {
    const { fileId, cookie } = await uploadAnonymousPdf('ruta-anon.pdf', 2)

    // Obtener sessionId via /auth/me
    const sessionId = await getAnonymousSessionId(cookie)

    // Verificar que el archivo existe en la ruta anónima
    const anonDir = join(TEST_STORAGE_PATH, 'anonymous', sessionId)
    expect(existsSync(anonDir)).toBe(true)

    const dirFiles = readdirSync(anonDir)
    expect(dirFiles.length).toBe(1)
    expect(dirFiles[0]).toContain(fileId)
    expect(dirFiles[0]).toContain('ruta-anon.pdf')

    // Verificar en DB que user_id es null y session_id está establecido
    const { eq } = await import('drizzle-orm')
    const fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows.length).toBe(1)
    expect(fileRows[0].userId).toBeNull()
    expect(fileRows[0].sessionId).toBe(sessionId)
    expect(fileRows[0].storagePath).toContain('anonymous')
    expect(fileRows[0].storagePath).toContain(sessionId)
  })
})

describe('Sesión anónima — listado de archivos', () => {
  test('GET /files — usuario anónimo ve solo sus archivos de sesión', async () => {
    // Subir 2 archivos con la misma sesión anónima
    const { cookie } = await uploadAnonymousPdf('doc1.pdf', 2)
    
    // Subir segundo archivo con la misma cookie
    const pdfBytes = await createTestPdf(3)
    const file2 = new File([pdfBytes], 'doc2.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', file2)

    await app.request('/files/upload', {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
      body: formData,
    })

    // Listar archivos con la sesión anónima
    const res = await app.request('/files', {
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.files.length).toBe(2)

    // Verificar que otra sesión anónima NO ve estos archivos
    const { cookie: otherCookie } = await uploadAnonymousPdf('otro-doc.pdf', 1)

    const otherRes = await app.request('/files', {
      headers: { Cookie: `session=${otherCookie}` },
    })

    const otherData = await otherRes.json()
    expect(otherData.files.length).toBe(1)
    expect(otherData.files[0].name).toBe('otro-doc.pdf')
  })
})

describe('Sesión anónima — GET /auth/me', () => {
  test('GET /auth/me — devuelve anonymous: true con sessionId', async () => {
    const { cookie } = await uploadAnonymousPdf('me-anon.pdf')

    const res = await app.request('/auth/me', {
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user).toBeNull()
    expect(data.anonymous).toBe(true)
    expect(data.sessionId).toBeDefined()
    expect(typeof data.sessionId).toBe('string')
  })
})

describe('Sesión anónima — registro y migración', () => {
  test('POST /auth/register — migra archivos anónimos al registrarse', async () => {
    // Subir archivo anónimo
    const { fileId, cookie: anonCookie } = await uploadAnonymousPdf('migrar.pdf', 4)

    // Verificar que el archivo es anónimo
    const { eq } = await import('drizzle-orm')
    let fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows[0].userId).toBeNull()
    expect(fileRows[0].sessionId).not.toBeNull()

    // Registrar usuario con la cookie anónima
    const email = `migrate-${crypto.randomUUID()}@email.com`
    const { userId, cookie: authCookie } = await registerUser(
      email,
      'password123',
      anonCookie,
    )

    // Verificar que el archivo ahora pertenece al usuario
    fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows[0].userId).toBe(userId)
    expect(fileRows[0].sessionId).toBeNull()

    // Verificar que el archivo es accesible con la cookie autenticada
    const filesRes = await app.request('/files', {
      headers: { Cookie: `session=${authCookie}` },
    })

    const filesData = await filesRes.json()
    expect(filesData.files.length).toBe(1)
    expect(filesData.files[0].id).toBe(fileId)
    expect(filesData.files[0].name).toBe('migrar.pdf')
  })
})

describe('POST /session/convert', () => {
  test('migra archivos de sesión anónima a usuario', async () => {
    // Subir archivos anónimos
    const { cookie: anonCookie } = await uploadAnonymousPdf('convert1.pdf', 2)
    
    const pdfBytes = await createTestPdf(3)
    const file2 = new File([pdfBytes], 'convert2.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', file2)
    await app.request('/files/upload', {
      method: 'POST',
      headers: { Cookie: `session=${anonCookie}` },
      body: formData,
    })

    // Obtener sessionId
    const sessionId = await getAnonymousSessionId(anonCookie)

    // Crear usuario manualmente (sin usar register para no auto-convertir)
    const userId = crypto.randomUUID()
    const passwordHash = await Bun.password.hash('password123', {
      algorithm: 'bcrypt',
      cost: 10,
    })
    await db.insert(users).values({
      id: userId,
      email: `convert-${crypto.randomUUID()}@email.com`,
      passwordHash,
      role: 'client',
      createdAt: Math.floor(Date.now() / 1000),
    })

    // Llamar a POST /session/convert
    const res = await app.request('/session/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.migratedFiles).toBe(2)

    // Verificar en DB
    const { eq, isNull } = await import('drizzle-orm')
    const migratedFiles = await db
      .select()
      .from(files)
      .where(eq(files.userId, userId))
    expect(migratedFiles.length).toBe(2)

    // Verificar que session_id es null
    for (const f of migratedFiles) {
      expect(f.sessionId).toBeNull()
    }
  })

  test('mueve archivos físicos a la carpeta del usuario', async () => {
    const { fileId, cookie: anonCookie } = await uploadAnonymousPdf(
      'fisico.pdf',
      2,
    )

    const sessionId = await getAnonymousSessionId(anonCookie)

    // Verificar que el archivo está en la carpeta anónima
    const anonDir = join(TEST_STORAGE_PATH, 'anonymous', sessionId)
    expect(existsSync(anonDir)).toBe(true)

    // Crear usuario
    const userId = crypto.randomUUID()
    const passwordHash = await Bun.password.hash('password123', {
      algorithm: 'bcrypt',
      cost: 10,
    })
    await db.insert(users).values({
      id: userId,
      email: `fisico-${crypto.randomUUID()}@email.com`,
      passwordHash,
      role: 'client',
      createdAt: Math.floor(Date.now() / 1000),
    })

    // Convertir sesión
    await app.request('/session/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    })

    // Verificar que la carpeta anónima ya no existe
    expect(existsSync(anonDir)).toBe(false)

    // Verificar que el archivo está en la carpeta del usuario
    const userDir = join(TEST_STORAGE_PATH, userId)
    expect(existsSync(userDir)).toBe(true)

    const userFiles = readdirSync(userDir)
    expect(userFiles.length).toBe(1)
    expect(userFiles[0]).toContain(fileId)
    expect(userFiles[0]).toContain('fisico.pdf')
  })

  test('actualiza storage_path en DB', async () => {
    const { fileId, cookie: anonCookie } = await uploadAnonymousPdf(
      'path-update.pdf',
      1,
    )

    const sessionId = await getAnonymousSessionId(anonCookie)

    // Obtener storage_path original
    const { eq } = await import('drizzle-orm')
    const beforeRows = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
    const originalPath = beforeRows[0].storagePath
    expect(originalPath).toContain('anonymous')
    expect(originalPath).toContain(sessionId)

    // Crear usuario
    const userId = crypto.randomUUID()
    const passwordHash = await Bun.password.hash('password123', {
      algorithm: 'bcrypt',
      cost: 10,
    })
    await db.insert(users).values({
      id: userId,
      email: `path-${crypto.randomUUID()}@email.com`,
      passwordHash,
      role: 'client',
      createdAt: Math.floor(Date.now() / 1000),
    })

    // Convertir sesión
    await app.request('/session/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    })

    // Verificar que storage_path se actualizó
    const afterRows = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
    const newPath = afterRows[0].storagePath
    expect(newPath).not.toContain('anonymous')
    expect(newPath).toContain(userId)
    expect(newPath).not.toBe(originalPath)
  })
})

describe('Sesión anónima — operaciones sobre archivos', () => {
  test('PATCH /files/:id/config — usuario anónimo puede configurar sus archivos', async () => {
    const { fileId, cookie } = await uploadAnonymousPdf('config-anon.pdf', 2)

    const res = await app.request(`/files/${fileId}/config`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size: 'A3', color: 'color', sides: 'double' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.config.size).toBe('A3')
    expect(data.config.color).toBe('color')
    expect(data.config.sides).toBe('double')
    expect(data.config.paper).toBe('normal-90') // no cambiado
  })

  test('DELETE /files/:id — usuario anónimo puede eliminar sus archivos', async () => {
    const { fileId, cookie } = await uploadAnonymousPdf('delete-anon.pdf', 1)

    // Verificar que existe
    const { eq } = await import('drizzle-orm')
    let fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows.length).toBe(1)
    const storagePath = fileRows[0].storagePath

    // Eliminar
    const res = await app.request(`/files/${fileId}`, {
      method: 'DELETE',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verificar que se eliminó de DB
    fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows.length).toBe(0)

    // Verificar que se eliminó del disco
    expect(existsSync(storagePath)).toBe(false)
  })
})
