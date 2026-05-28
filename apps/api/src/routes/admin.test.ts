import { describe, test, expect, beforeEach } from 'bun:test'
import { PDFDocument } from 'pdf-lib'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// Configurar entorno de test ANTES de importar módulos que dependen de env
process.env.DATABASE_URL = ':memory:'
process.env.SESSION_SECRET = 'test-secret-for-admin-tests'
process.env.STORAGE_PATH = './storage/test-admin-uploads'
process.env.ADMIN_USER = 'admin'
process.env.ADMIN_PASSWORD = 'admin-secret'
process.env.MAX_FILE_SIZE_MB = '50'
process.env.FILE_EXPIRY_DAYS = '90'

// Imports dinámicos después de configurar env
const { app } = await import('../index')
const { db } = await import('../db/index')
const { users, files, printConfigs, printJobs, printJobFiles } = await import('../db/schema')
const { clearSessions } = await import('../middleware/auth')
const { clearAdminSessions } = await import('../middleware/adminAuth')

const TEST_STORAGE_PATH = './storage/test-admin-uploads'
const ADMIN_SYSTEM_ID = 'admin'

// --- Helpers ---

function extractCookie(response: Response, name: string): string | null {
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []
  for (const header of setCookieHeaders) {
    if (header.startsWith(`${name}=`)) {
      const value = header.split(';')[0].replace(`${name}=`, '')
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

async function loginAdmin(): Promise<string> {
  const res = await app.request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin-secret' }),
  })
  const cookie = extractCookie(res, 'admin_session')
  if (!cookie) throw new Error('No se pudo obtener cookie de admin')
  return cookie
}

async function createClientUser(email: string): Promise<string> {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  await db.insert(users).values({
    id,
    email,
    passwordHash: await Bun.password.hash('password123', { algorithm: 'bcrypt', cost: 4 }),
    role: 'client',
    createdAt: now,
  })
  return id
}

async function createAdminSystemUser(): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  try {
    await db.insert(users).values({
      id: ADMIN_SYSTEM_ID,
      email: 'admin@system.local',
      passwordHash: 'system-admin-no-login',
      role: 'admin',
      createdAt: now,
    })
  } catch {
    // Ya existe, ignorar
  }
}

async function createFileForClient(
  clientId: string,
  fileName: string,
  pageCount: number,
  config?: { size?: string; color?: string; sides?: string; paper?: string },
  status: string = 'pending',
): Promise<string> {
  const fileId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  // Crear archivo PDF real en disco
  const pdfBytes = await createTestPdf(pageCount)
  const userDir = join(TEST_STORAGE_PATH, clientId)
  mkdirSync(userDir, { recursive: true })
  const storagePath = join(userDir, `${fileId}_${fileName}`)
  writeFileSync(storagePath, pdfBytes)

  await db.insert(files).values({
    id: fileId,
    userId: clientId,
    filename: fileName,
    originalName: fileName,
    storagePath,
    mimeType: 'application/pdf',
    sizeBytes: pdfBytes.length,
    pageCount,
    status,
    uploadedAt: now,
    expiresAt: now + 90 * 24 * 60 * 60,
  })

  await db.insert(printConfigs).values({
    id: crypto.randomUUID(),
    fileId,
    size: config?.size ?? 'A4',
    color: config?.color ?? 'bw',
    sides: config?.sides ?? 'single',
    paper: config?.paper ?? 'normal-90',
    updatedAt: now,
  })

  return fileId
}

// --- Setup / Teardown ---

beforeEach(async () => {
  await db.delete(printJobFiles)
  await db.delete(printJobs)
  await db.delete(printConfigs)
  await db.delete(files)
  await db.delete(users)
  clearSessions()
  clearAdminSessions()

  // Limpiar storage de test
  if (existsSync(TEST_STORAGE_PATH)) {
    rmSync(TEST_STORAGE_PATH, { recursive: true, force: true })
  }

  // Crear usuario admin de sistema para FK constraints
  await createAdminSystemUser()
})

// --- Tests ---

describe('POST /admin/login', () => {
  test('autenticación exitosa', async () => {
    const res = await app.request('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin-secret' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verificar que se estableció la cookie de admin
    const cookie = extractCookie(res, 'admin_session')
    expect(cookie).not.toBeNull()
  })

  test('credenciales inválidas', async () => {
    const res = await app.request('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    })

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('INVALID_CREDENTIALS')
    expect(data.message).toBeDefined()
  })
})

describe('GET /admin/clients', () => {
  test('lista clientes con conteo de pendientes', async () => {
    const adminCookie = await loginAdmin()

    const client1 = await createClientUser('cliente1@email.com')
    const client2 = await createClientUser('cliente2@email.com')

    // Cliente 1 tiene 2 archivos pending
    await createFileForClient(client1, 'doc1.pdf', 3)
    await createFileForClient(client1, 'doc2.pdf', 5)

    // Cliente 2 tiene 1 archivo pending y 1 printed
    await createFileForClient(client2, 'doc3.pdf', 2)
    await createFileForClient(client2, 'doc4.pdf', 4, undefined, 'printed')

    const res = await app.request('/admin/clients', {
      headers: { Cookie: `admin_session=${adminCookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.clients).toBeDefined()
    expect(Array.isArray(data.clients)).toBe(true)
    expect(data.clients.length).toBe(2)

    // Verificar estructura
    const c1 = data.clients.find((c: { id: string }) => c.id === client1)
    expect(c1).toBeDefined()
    expect(c1.email).toBe('cliente1@email.com')
    expect(c1.pendingCount).toBe(2)
    expect(typeof c1.lastActivityAt).toBe('number')
    expect(typeof c1.createdAt).toBe('number')

    const c2 = data.clients.find((c: { id: string }) => c.id === client2)
    expect(c2).toBeDefined()
    expect(c2.pendingCount).toBe(1)
  })

  test('ordena pendientes primero', async () => {
    const adminCookie = await loginAdmin()

    const client1 = await createClientUser('sin-pendientes@email.com')
    const client2 = await createClientUser('con-pendientes@email.com')

    // Cliente 1 sin pendientes (solo printed)
    await createFileForClient(client1, 'impreso.pdf', 2, undefined, 'printed')

    // Cliente 2 con pendientes
    await createFileForClient(client2, 'pendiente.pdf', 3)

    const res = await app.request('/admin/clients', {
      headers: { Cookie: `admin_session=${adminCookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    // El cliente con pendientes debe aparecer primero
    expect(data.clients[0].id).toBe(client2)
    expect(data.clients[0].pendingCount).toBe(1)
    expect(data.clients[1].id).toBe(client1)
    expect(data.clients[1].pendingCount).toBe(0)
  })
})

describe('GET /admin/clients/:id', () => {
  test('detalle con grupos', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('detalle@email.com')

    // Crear archivos con la misma config (deben agruparse)
    await createFileForClient(clientId, 'apuntes.pdf', 4, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    })
    await createFileForClient(clientId, 'notas.pdf', 6, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    })

    // Crear archivo con config diferente
    await createFileForClient(clientId, 'foto.pdf', 1, {
      size: 'A4',
      color: 'color',
      sides: 'single',
      paper: 'normal-90',
    })

    // Crear archivo impreso
    await createFileForClient(clientId, 'contrato.pdf', 3, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    }, 'printed')

    const res = await app.request(`/admin/clients/${clientId}`, {
      headers: { Cookie: `admin_session=${adminCookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()

    // Verificar cliente
    expect(data.client).toBeDefined()
    expect(data.client.id).toBe(clientId)
    expect(data.client.email).toBe('detalle@email.com')
    expect(typeof data.client.createdAt).toBe('number')

    // Verificar grupos (debe haber 2: A4-bw-single-normal-90 y A4-color-single-normal-90)
    expect(data.groups).toBeDefined()
    expect(Array.isArray(data.groups)).toBe(true)
    expect(data.groups.length).toBe(2)

    // Grupo A4-bw-single-normal-90 debe tener 2 archivos
    const bwGroup = data.groups.find((g: { groupKey: string }) => g.groupKey === 'A4-bw-single-normal-90')
    expect(bwGroup).toBeDefined()
    expect(bwGroup.files.length).toBe(2)
    expect(bwGroup.totalPages).toBe(10) // 4 + 6
    expect(bwGroup.config.size).toBe('A4')
    expect(bwGroup.config.color).toBe('bw')

    // Verificar estructura de archivos en el grupo
    const file = bwGroup.files[0]
    expect(file.id).toBeDefined()
    expect(file.name).toBeDefined()
    expect(typeof file.pageCount).toBe('number')
    expect(typeof file.uploadedAt).toBe('number')

    // Grupo A4-color-single-normal-90 debe tener 1 archivo
    const colorGroup = data.groups.find((g: { groupKey: string }) => g.groupKey === 'A4-color-single-normal-90')
    expect(colorGroup).toBeDefined()
    expect(colorGroup.files.length).toBe(1)
    expect(colorGroup.totalPages).toBe(1)

    // Verificar archivos impresos
    expect(data.printedFiles).toBeDefined()
    expect(Array.isArray(data.printedFiles)).toBe(true)
    expect(data.printedFiles.length).toBe(1)
    expect(data.printedFiles[0].name).toBe('contrato.pdf')
    expect(data.printedFiles[0].config).toBeDefined()
    expect(typeof data.printedFiles[0].printedAt).toBe('number')
  })

  test('404 si cliente no existe', async () => {
    const adminCookie = await loginAdmin()
    const fakeId = crypto.randomUUID()

    const res = await app.request(`/admin/clients/${fakeId}`, {
      headers: { Cookie: `admin_session=${adminCookie}` },
    })

    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('NOT_FOUND')
  })
})

describe('GET /admin/clients/:id/groups/:groupKey/download', () => {
  test('descarga PDF y marca como printed', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('descarga@email.com')

    const fileId1 = await createFileForClient(clientId, 'doc1.pdf', 3, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    })
    const fileId2 = await createFileForClient(clientId, 'doc2.pdf', 5, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    })

    const groupKey = 'A4-bw-single-normal-90'

    const res = await app.request(
      `/admin/clients/${clientId}/groups/${groupKey}/download`,
      {
        headers: { Cookie: `admin_session=${adminCookie}` },
      },
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain(`grupo_${groupKey}.pdf`)

    // Verificar que el body es un PDF válido
    const pdfBytes = new Uint8Array(await res.arrayBuffer())
    expect(pdfBytes.length).toBeGreaterThan(0)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    expect(pdfDoc.getPageCount()).toBe(8) // 3 + 5

    // Verificar que los archivos se marcaron como printed
    const { eq } = await import('drizzle-orm')
    const file1 = await db.select().from(files).where(eq(files.id, fileId1))
    expect(file1[0].status).toBe('printed')

    const file2 = await db.select().from(files).where(eq(files.id, fileId2))
    expect(file2[0].status).toBe('printed')
  })

  test('registra print_job en DB', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('printjob@email.com')

    const fileId1 = await createFileForClient(clientId, 'doc1.pdf', 2, {
      size: 'A4',
      color: 'bw',
      sides: 'single',
      paper: 'normal-90',
    })

    const groupKey = 'A4-bw-single-normal-90'

    const res = await app.request(
      `/admin/clients/${clientId}/groups/${groupKey}/download`,
      {
        headers: { Cookie: `admin_session=${adminCookie}` },
      },
    )

    expect(res.status).toBe(200)

    // Verificar print_job
    const { eq } = await import('drizzle-orm')
    const jobs = await db.select().from(printJobs)
    expect(jobs.length).toBe(1)
    expect(jobs[0].groupKey).toBe(groupKey)
    expect(jobs[0].clientId).toBe(clientId)
    expect(jobs[0].adminId).toBe(ADMIN_SYSTEM_ID)
    expect(typeof jobs[0].downloadedAt).toBe('number')
    expect(typeof jobs[0].createdAt).toBe('number')

    // Verificar print_job_files
    const jobFiles = await db.select().from(printJobFiles)
    expect(jobFiles.length).toBe(1)
    expect(jobFiles[0].jobId).toBe(jobs[0].id)
    expect(jobFiles[0].fileId).toBe(fileId1)
  })
})

describe('GET /admin/files/:fileId/original', () => {
  test('descarga archivo original', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('original@email.com')

    const fileId = await createFileForClient(clientId, 'mi-documento.pdf', 3)

    const res = await app.request(`/admin/files/${fileId}/original`, {
      headers: { Cookie: `admin_session=${adminCookie}` },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('mi-documento.pdf')

    // Verificar que el body tiene contenido
    const body = new Uint8Array(await res.arrayBuffer())
    expect(body.length).toBeGreaterThan(0)
  })
})

describe('PATCH /admin/files/:fileId/status', () => {
  test('cambia estado a pending', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('status-pending@email.com')

    const fileId = await createFileForClient(clientId, 'doc.pdf', 2, undefined, 'printed')

    const res = await app.request(`/admin/files/${fileId}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `admin_session=${adminCookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'pending' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verificar en DB
    const { eq } = await import('drizzle-orm')
    const fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows[0].status).toBe('pending')
  })

  test('cambia estado a printed', async () => {
    const adminCookie = await loginAdmin()
    const clientId = await createClientUser('status-printed@email.com')

    const fileId = await createFileForClient(clientId, 'doc.pdf', 2)

    const res = await app.request(`/admin/files/${fileId}/status`, {
      method: 'PATCH',
      headers: {
        Cookie: `admin_session=${adminCookie}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'printed' }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verificar en DB
    const { eq } = await import('drizzle-orm')
    const fileRows = await db.select().from(files).where(eq(files.id, fileId))
    expect(fileRows[0].status).toBe('printed')
  })
})

describe('GET /admin/* — 401 sin autenticación admin', () => {
  test('devuelve 401 sin cookie de admin', async () => {
    const res = await app.request('/admin/clients')

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })

  test('devuelve 401 con cookie inválida', async () => {
    const res = await app.request('/admin/clients', {
      headers: { Cookie: 'admin_session=invalid-cookie' },
    })

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })

  test('devuelve 401 en descarga sin auth', async () => {
    const res = await app.request('/admin/clients/fake-id/groups/fake-key/download')

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })

  test('devuelve 401 en archivo original sin auth', async () => {
    const res = await app.request('/admin/files/fake-id/original')

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })

  test('devuelve 401 en cambio de status sin auth', async () => {
    const res = await app.request('/admin/files/fake-id/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'printed' }),
    })

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('UNAUTHORIZED')
  })
})
