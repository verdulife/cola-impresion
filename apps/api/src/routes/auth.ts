import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { users } from '../db/schema'
import type { AppEnv } from '../middleware/auth'
import {
  createSession,
  resolveSession,
  removeSession,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/auth'
import { convertAnonymousSession } from './session'

const auth = new Hono<AppEnv>()

// --- Validación ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRegisterBody(
  body: unknown,
): { email: string; password: string } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Body inválido' }
  }

  const { email, password } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return { error: 'Email no válido' }
  }

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }

  return { email, password }
}

// --- POST /auth/register ---

auth.post('/register', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body JSON inválido' },
      400,
    )
  }

  const validated = validateRegisterBody(body)
  if ('error' in validated) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: validated.error },
      400,
    )
  }

  const { email, password } = validated

  // Hash de contraseña con API nativa de Bun (bcrypt)
  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10,
  })

  const id = crypto.randomUUID()
  const createdAt = Math.floor(Date.now() / 1000)

  try {
    await db.insert(users).values({
      id,
      email,
      passwordHash,
      role: 'client',
      createdAt,
    })
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes('UNIQUE constraint failed')
    ) {
      return c.json(
        { error: 'EMAIL_IN_USE', message: 'El email ya está registrado' },
        409,
      )
    }
    throw err
  }

  // Si hay sesión anónima activa, migrar archivos a la cuenta nueva
  const existingSession = await resolveSession(c)
  if (existingSession && existingSession.session.anonymous) {
    await convertAnonymousSession(existingSession.sessionId, id)
  }

  // Crear sesión autenticada y establecer cookie
  const signedSession = await createSession(id)
  setSessionCookie(c, signedSession)

  return c.json(
    {
      user: { id, email, createdAt },
    },
    201,
  )
})

// --- POST /auth/login ---

auth.post('/login', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      { error: 'VALIDATION_ERROR', message: 'Body JSON inválido' },
      400,
    )
  }

  const validated = validateRegisterBody(body)
  if ('error' in validated) {
    return c.json(
      { error: 'VALIDATION_ERROR', message: validated.error },
      400,
    )
  }

  const { email, password } = validated

  // Buscar usuario por email
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))

  const user = result[0]

  if (!user) {
    return c.json(
      { error: 'INVALID_CREDENTIALS', message: 'Credenciales incorrectas' },
      401,
    )
  }

  // Verificar contraseña
  const validPassword = await Bun.password.verify(password, user.passwordHash)

  if (!validPassword) {
    return c.json(
      { error: 'INVALID_CREDENTIALS', message: 'Credenciales incorrectas' },
      401,
    )
  }

  // Crear sesión y establecer cookie
  const signedSession = await createSession(user.id)
  setSessionCookie(c, signedSession)

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  })
})

// --- POST /auth/logout ---

auth.post('/logout', async (c) => {
  const result = await resolveSession(c)
  if (result) {
    removeSession(result.sessionId)
  }
  clearSessionCookie(c)
  return c.json({ ok: true })
})

// --- GET /auth/me ---

auth.get('/me', async (c) => {
  const result = await resolveSession(c)

  if (!result) {
    return c.json({ user: null, anonymous: false })
  }

  const { sessionId, session } = result

  // Sesión anónima
  if (session.anonymous) {
    return c.json({ user: null, anonymous: true, sessionId })
  }

  // Sesión autenticada — buscar usuario en DB
  if (!session.userId) {
    return c.json({ user: null, anonymous: false })
  }

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))

  const user = userResult[0]

  if (!user) {
    return c.json({ user: null, anonymous: false })
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    anonymous: false,
  })
})

export default auth
