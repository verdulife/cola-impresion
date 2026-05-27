import { describe, test, expect, beforeEach } from 'bun:test'

// Configurar entorno de test ANTES de importar módulos que dependen de env
process.env.DATABASE_URL = ':memory:'
process.env.SESSION_SECRET = 'test-secret-for-auth-tests'

// Imports dinámicos después de configurar env
const { app } = await import('../index')
const { db } = await import('../db/index')
const { users } = await import('../db/schema')
const { clearSessions } = await import('../middleware/auth')

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

function isCookieCleared(response: Response): boolean {
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []
  for (const header of setCookieHeaders) {
    if (header.startsWith('session=') || header.startsWith('session=;')) {
      // Cookie cleared if value is empty or Max-Age=0
      if (
        header.includes('Max-Age=0') ||
        header.includes('session=;') ||
        header.match(/^session=;/)
      ) {
        return true
      }
    }
  }
  return false
}

async function registerUser(
  email: string,
  password: string,
): Promise<Response> {
  return app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

async function loginUser(
  email: string,
  password: string,
): Promise<Response> {
  return app.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

// --- Setup / Teardown ---

beforeEach(async () => {
  await db.delete(users)
  clearSessions()
})

// --- Tests ---

describe('POST /auth/register', () => {
  test('crea usuario y devuelve 201', async () => {
    const res = await registerUser('test@email.com', 'password123')

    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('test@email.com')
    expect(data.user.id).toBeDefined()
    expect(data.user.createdAt).toBeDefined()
    expect(typeof data.user.id).toBe('string')
    expect(typeof data.user.createdAt).toBe('number')

    // Verificar que se estableció la cookie de sesión
    const cookie = extractSessionCookie(res)
    expect(cookie).not.toBeNull()
  })

  test('devuelve 409 si el email ya existe', async () => {
    await registerUser('duplicado@email.com', 'password123')

    const res = await registerUser('duplicado@email.com', 'otraPassword1')

    expect(res.status).toBe(409)

    const data = await res.json()
    expect(data.error).toBe('EMAIL_IN_USE')
    expect(data.message).toBeDefined()
  })

  test('devuelve 400 si la contraseña es < 8 chars', async () => {
    const res = await registerUser('test@email.com', 'corta')

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('VALIDATION_ERROR')
    expect(data.message).toContain('8 caracteres')
  })

  test('devuelve 400 si el email no es válido', async () => {
    const res = await registerUser('no-es-email', 'password123')

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('VALIDATION_ERROR')
  })
})

describe('POST /auth/login', () => {
  test('devuelve 200 con credenciales correctas', async () => {
    await registerUser('login@email.com', 'password123')

    const res = await loginUser('login@email.com', 'password123')

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('login@email.com')
    expect(data.user.id).toBeDefined()
    expect(data.user.createdAt).toBeDefined()

    // Verificar que se estableció la cookie de sesión
    const cookie = extractSessionCookie(res)
    expect(cookie).not.toBeNull()
  })

  test('devuelve 401 con credenciales incorrectas', async () => {
    await registerUser('login@email.com', 'password123')

    const res = await loginUser('login@email.com', 'wrongpassword')

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('INVALID_CREDENTIALS')
  })

  test('devuelve 401 si el email no existe', async () => {
    const res = await loginUser('noexiste@email.com', 'password123')

    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('INVALID_CREDENTIALS')
  })
})

describe('POST /auth/logout', () => {
  test('elimina la sesión', async () => {
    // Registrar y obtener cookie
    const registerRes = await registerUser('logout@email.com', 'password123')
    const cookie = extractSessionCookie(registerRes)
    expect(cookie).not.toBeNull()

    // Verificar que la sesión funciona
    const meBeforeRes = await app.request('/auth/me', {
      headers: { Cookie: `session=${cookie}` },
    })
    const meBefore = await meBeforeRes.json()
    expect(meBefore.user).not.toBeNull()

    // Logout
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
    })

    expect(logoutRes.status).toBe(200)
    const logoutData = await logoutRes.json()
    expect(logoutData.ok).toBe(true)

    // Verificar que la cookie se limpió
    expect(isCookieCleared(logoutRes)).toBe(true)

    // Verificar que la sesión ya no es válida
    const meAfterRes = await app.request('/auth/me', {
      headers: { Cookie: `session=${cookie}` },
    })
    const meAfter = await meAfterRes.json()
    expect(meAfter.user).toBeNull()
  })
})

describe('GET /auth/me', () => {
  test('devuelve usuario autenticado', async () => {
    const registerRes = await registerUser('me@email.com', 'password123')
    const cookie = extractSessionCookie(registerRes)
    expect(cookie).not.toBeNull()

    const res = await app.request('/auth/me', {
      headers: { Cookie: `session=${cookie}` },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user).not.toBeNull()
    expect(data.user.email).toBe('me@email.com')
    expect(data.user.id).toBeDefined()
    expect(data.user.createdAt).toBeDefined()
    expect(data.anonymous).toBe(false)
  })

  test('devuelve null sin sesión', async () => {
    const res = await app.request('/auth/me')

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user).toBeNull()
    expect(data.anonymous).toBe(false)
  })

  test('devuelve null con cookie inválida', async () => {
    const res = await app.request('/auth/me', {
      headers: { Cookie: 'session=invalid-cookie-value' },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user).toBeNull()
    expect(data.anonymous).toBe(false)
  })
})
