import { describe, test, expect, beforeEach } from 'bun:test'
import { PDFDocument } from 'pdf-lib'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'

// Configurar entorno de test ANTES de importar módulos que dependen de env
process.env.DATABASE_URL = ':memory:'
process.env.SESSION_SECRET = 'test-secret-for-files-tests'
process.env.STORAGE_PATH = './storage/test-uploads'
process.env.MAX_FILE_SIZE_MB = '50'
process.env.FILE_EXPIRY_DAYS = '90'

// Imports dinámicos después de configurar env
const { app } = await import('../index')
const { db } = await import('../db/index')
const { users, files, printConfigs } = await import('../db/schema')
const { clearSessions } = await import('../middleware/auth')

const TEST_STORAGE_PATH = './storage/test-uploads'

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
    doc.addPage([595, 842]) // A4
  }
  return await doc.save()
}

async function registerAndGetCookie(): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `test-${crypto.randomUUID()}@email.com`,
      password: 'password123',
    }),
  })
  const cookie = extractSessionCookie(res)
  if (!cookie) throw new Error('No se pudo obtener cookie de sesión')
  return cookie
}

async function uploadFile(
  cookie: string,
  file: File,
): Promise<Response> {
  const formData = new FormData()
  formData.append('file', file)

  return app.request('/files/upload', {
    method: 'POST',
    headers: { Cookie: `session=${cookie}` },
    body: formData,
  })
}

async function uploadTestPdf(cookie: string, name: string = 'test.pdf', pages: number = 2): Promise<{ fileId: string; res: Response }> {
  const pdfBytes = await createTestPdf(pages)
  const file = new File([pdfBytes], name, { type: 'application/pdf' })
  const res = await uploadFile(cookie, file)
  const data = await res.json()
  return { fileId: data.file.id, res }
}

// --- Setup / Teardown ---

beforeEach(async () => {
  await db.delete(printConfigs)
  await db.delete(files)
  await db.delete(users)
  clearSessions()

  // Limpiar storage de test
  if (existsSync(TEST_STORAGE_PATH)) {
    rmSync(TEST_STORAGE_PATH, { recursive: true, force: true })
  }
})

// --- Tests ---

describe('POST /files/upload', () => {
  test('sube PDF correctamente y devuelve 201', async () => {
    const cookie = await registerAndGetCookie()
    const pdfBytes = await createTestPdf(3)
    const file = new File([pdfBytes], 'documento.pdf', {
      type: 'application/pdf',
    })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.file).toBeDefined()
    expect(data.file.id).toBeDefined()
    expect(typeof data.file.id).toBe('string')
    expect(data.file.name).toBe('documento.pdf')
    expect(data.file.mimeType).toBe('application/pdf')
    expect(data.file.sizeBytes).toBe(pdfBytes.length)
    expect(data.file.pageCount).toBe(3)
    expect(data.file.status).toBe('pending')
    expect(typeof data.file.uploadedAt).toBe('number')
    expect(typeof data.file.expiresAt).toBe('number')
    expect(data.file.expiresAt).toBeGreaterThan(data.file.uploadedAt)

    // Verificar config por defecto
    expect(data.file.config).toBeDefined()
    expect(data.file.config.size).toBe('A4')
    expect(data.file.config.color).toBe('bw')
    expect(data.file.config.sides).toBe('single')
    expect(data.file.config.paper).toBe('normal-90')
  })

  test('sube imagen JPG correctamente', async () => {
    const cookie = await registerAndGetCookie()
    // Crear un blob mínimo que simule un JPG (sin bytes nulos para evitar problemas de encoding)
    const jpgData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x01])
    const file = new File([jpgData], 'foto.jpg', { type: 'image/jpeg' })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.file.name).toBe('foto.jpg')
    expect(data.file.mimeType).toBe('image/jpeg')
    expect(data.file.pageCount).toBe(1) // Las imágenes siempre tienen 1 página
    expect(data.file.sizeBytes).toBeGreaterThan(0)
  })

  test('devuelve 400 si el tipo no es válido', async () => {
    const cookie = await registerAndGetCookie()
    const file = new File(['contenido de texto'], 'documento.txt', {
      type: 'text/plain',
    })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('INVALID_FILE_TYPE')
    expect(data.message).toBeDefined()
  })

  test('devuelve 400 si el archivo supera 50MB', async () => {
    const cookie = await registerAndGetCookie()
    // Crear un blob de 51MB
    const oversizedData = new Uint8Array(51 * 1024 * 1024)
    const file = new File([oversizedData], 'grande.pdf', {
      type: 'application/pdf',
    })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('FILE_TOO_LARGE')
    expect(data.message).toBeDefined()
  })

  test('sube archivo sin autenticación creando sesión anónima', async () => {
    const pdfBytes = await createTestPdf(1)
    const file = new File([pdfBytes], 'anon-documento.pdf', {
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

    // Verificar que se estableció cookie de sesión anónima
    const cookie = extractSessionCookie(res)
    expect(cookie).not.toBeNull()
  })

  test('el archivo se guarda en disco', async () => {
    const cookie = await registerAndGetCookie()
    const pdfBytes = await createTestPdf(1)
    const file = new File([pdfBytes], 'test-disco.pdf', {
      type: 'application/pdf',
    })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(201)

    const data = await res.json()
    const fileId = data.file.id

    // Verificar que el archivo existe en el storage de test
    // Estructura: {storagePath}/{userId}/{fileId}_{sanitizedFilename}
    const storageDir = join(TEST_STORAGE_PATH)
    expect(existsSync(storageDir)).toBe(true)

    // Buscar el archivo en el directorio del usuario
    const { readdirSync } = await import('fs')
    const userDirs = readdirSync(storageDir)
    expect(userDirs.length).toBeGreaterThan(0)

    const userDir = join(storageDir, userDirs[0])
    const userFiles = readdirSync(userDir)
    expect(userFiles.length).toBe(1)
    expect(userFiles[0]).toContain(fileId)
    expect(userFiles[0]).toContain('test-disco.pdf')
  })

  test('se crea print_config con valores por defecto', async () => {
    const cookie = await registerAndGetCookie()
    const pdfBytes = await createTestPdf(2)
    const file = new File([pdfBytes], 'config-test.pdf', {
      type: 'application/pdf',
    })

    const res = await uploadFile(cookie, file)

    expect(res.status).toBe(201)

    const data = await res.json()
    const fileId = data.file.id

    // Verificar en DB que se creó el print_config
    const { eq } = await import('drizzle-orm')
    const configs = await db
      .select()
      .from(printConfigs)
      .where(eq(printConfigs.fileId, fileId))

    expect(configs.length).toBe(1)
    expect(configs[0].size).toBe('A4')
    expect(configs[0].color).toBe('bw')
    expect(configs[0].sides).toBe('single')
    expect(configs[0].paper).toBe('normal-90')
  })
})

// --- GET /files ---

describe('GET /files', () => {
  test('lista archivos del usuario autenticado', async () => {
    const cookie = await registerAndGetCookie()
    await uploadTestPdf(cookie, 'doc1.pdf', 3)
    await uploadTestPdf(cookie, 'doc2.pdf', 5)

    const res = await app.request('/files', {
      method: 'GET',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.files).toBeDefined()
    expect(Array.isArray(data.files)).toBe(true)
    expect(data.files.length).toBe(2)

    // Verificar estructura de cada archivo
    const file = data.files[0]
    expect(file.id).toBeDefined()
    expect(file.name).toBeDefined()
    expect(file.mimeType).toBe('application/pdf')
    expect(typeof file.sizeBytes).toBe('number')
    expect(typeof file.pageCount).toBe('number')
    expect(file.status).toBe('pending')
    expect(typeof file.uploadedAt).toBe('number')
    expect(typeof file.expiresAt).toBe('number')
    expect(file.config).toBeDefined()
    expect(file.config.size).toBe('A4')
    expect(file.config.color).toBe('bw')
    expect(file.config.sides).toBe('single')
    expect(file.config.paper).toBe('normal-90')
  })

  test('filtra por status=pending', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId: id1 } = await uploadTestPdf(cookie, 'pendiente.pdf')
    const { fileId: id2 } = await uploadTestPdf(cookie, 'impreso.pdf')

    // Cambiar estado del segundo archivo a printed
    await app.request(`/files/${id2}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'printed' }),
    })

    // Filtrar por pending
    const res = await app.request('/files?status=pending', {
      method: 'GET',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.files.length).toBe(1)
    expect(data.files[0].id).toBe(id1)
    expect(data.files[0].status).toBe('pending')
  })

  test('devuelve lista vacía sin autenticación previa (crea sesión anónima)', async () => {
    const res = await app.request('/files', {
      method: 'GET',
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.files).toBeDefined()
    expect(data.files.length).toBe(0)
  })
})

// --- GET /files/:id ---

describe('GET /files/:id', () => {
  test('devuelve detalle del archivo', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie, 'detalle.pdf', 4)

    const res = await app.request(`/files/${fileId}`, {
      method: 'GET',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.id).toBe(fileId)
    expect(data.name).toBe('detalle.pdf')
    expect(data.mimeType).toBe('application/pdf')
    expect(data.pageCount).toBe(4)
    expect(data.status).toBe('pending')
    expect(data.config).toBeDefined()
    expect(data.config.size).toBe('A4')
    expect(data.config.color).toBe('bw')
    expect(data.config.sides).toBe('single')
    expect(data.config.paper).toBe('normal-90')
  })

  test('devuelve 404 si no existe', async () => {
    const cookie = await registerAndGetCookie()
    const fakeId = crypto.randomUUID()

    const res = await app.request(`/files/${fakeId}`, {
      method: 'GET',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('NOT_FOUND')
  })

  test('devuelve 403 si no pertenece al usuario', async () => {
    const cookie1 = await registerAndGetCookie()
    const cookie2 = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie1, 'privado.pdf')

    // Intentar acceder con otro usuario
    const res = await app.request(`/files/${fileId}`, {
      method: 'GET',
      headers: { Cookie: `session=${cookie2}` },
    })

    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toBe('FORBIDDEN')
  })
})

// --- PATCH /files/:id/config ---

describe('PATCH /files/:id/config', () => {
  test('actualiza configuración parcialmente', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie, 'config.pdf')

    const res = await app.request(`/files/${fileId}/config`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size: 'A3', color: 'color' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.config).toBeDefined()
    expect(data.config.size).toBe('A3')
    expect(data.config.color).toBe('color')
    // Los campos no enviados deben mantener su valor anterior
    expect(data.config.sides).toBe('single')
    expect(data.config.paper).toBe('normal-90')
  })

  test('devuelve 400 con valor inválido', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie, 'config-invalid.pdf')

    const res = await app.request(`/files/${fileId}/config`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size: 'B5' }),
    })

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('VALIDATION_ERROR')
  })

  test('devuelve 403 si no pertenece al usuario', async () => {
    const cookie1 = await registerAndGetCookie()
    const cookie2 = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie1, 'ajeno.pdf')

    const res = await app.request(`/files/${fileId}/config`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie2}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size: 'A3' }),
    })

    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toBe('FORBIDDEN')
  })
})

// --- PATCH /files/:id/status ---

describe('PATCH /files/:id/status', () => {
  test('cambia estado a pending', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie, 'reimprimir.pdf')

    // Primero cambiar a printed
    await app.request(`/files/${fileId}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'printed' }),
    })

    // Ahora reimprimir (volver a pending)
    const res = await app.request(`/files/${fileId}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'pending' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verificar que el estado cambió en DB
    const { eq } = await import('drizzle-orm')
    const fileRows = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))

    expect(fileRows[0].status).toBe('pending')
  })
})

// --- DELETE /files/:id ---

describe('DELETE /files/:id', () => {
  test('elimina archivo y registro', async () => {
    const cookie = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie, 'borrar.pdf')

    // Verificar que existe en DB
    const { eq } = await import('drizzle-orm')
    let fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows.length).toBe(1)

    const storagePath = fileRows[0].storagePath

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

    // Verificar que print_configs también se eliminó (CASCADE)
    const configRows = await db
      .select()
      .from(printConfigs)
      .where(eq(printConfigs.fileId, fileId))
    expect(configRows.length).toBe(0)

    // Verificar que el archivo físico se eliminó
    expect(existsSync(storagePath)).toBe(false)
  })

  test('devuelve 404 si no existe', async () => {
    const cookie = await registerAndGetCookie()
    const fakeId = crypto.randomUUID()

    const res = await app.request(`/files/${fakeId}`, {
      method: 'DELETE',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('NOT_FOUND')
  })

  test('devuelve 403 si no pertenece al usuario', async () => {
    const cookie1 = await registerAndGetCookie()
    const cookie2 = await registerAndGetCookie()
    const { fileId } = await uploadTestPdf(cookie1, 'protegido.pdf')

    const res = await app.request(`/files/${fileId}`, {
      method: 'DELETE',
      headers: { Cookie: `session=${cookie2}` },
    })

    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toBe('FORBIDDEN')

    // Verificar que el archivo sigue existiendo
    const { eq } = await import('drizzle-orm')
    const fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows.length).toBe(1)
  })
})
