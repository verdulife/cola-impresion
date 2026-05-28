import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'

// --- Tipos ---

export type AppEnv = {
  Variables: {
    userId?: string
    sessionId?: string
    isAnonymous?: boolean
  }
}

type Session = {
  userId?: string
  anonymous?: boolean
  createdAt: number
}

// --- Session store (en memoria para V1) ---

const sessions = new Map<string, Session>()

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

// --- Firma y verificación de cookies con HMAC-SHA256 ---

async function importKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

async function signValue(value: string): Promise<string> {
  const key = await importKey('sign')
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const sigHex = Buffer.from(sig).toString('hex')
  return `${value}.${sigHex}`
}

async function verifyValue(signed: string): Promise<string | null> {
  const dotIndex = signed.lastIndexOf('.')
  if (dotIndex === -1) return null

  const value = signed.slice(0, dotIndex)
  const sigHex = signed.slice(dotIndex + 1)

  if (!value || !sigHex) return null

  try {
    const key = await importKey('verify')
    const sig = Buffer.from(sigHex, 'hex')
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(value))
    return valid ? value : null
  } catch {
    return null
  }
}

// --- Gestión de sesiones ---

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, { userId, createdAt: Math.floor(Date.now() / 1000) })
  return signValue(sessionId)
}

export async function createAnonymousSession(): Promise<{
  sessionId: string
  signedValue: string
}> {
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, {
    anonymous: true,
    createdAt: Math.floor(Date.now() / 1000),
  })
  const signedValue = await signValue(sessionId)
  return { sessionId, signedValue }
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId)
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function clearSessions(): void {
  sessions.clear()
}

// --- Helpers de cookie ---

export function setSessionCookie(c: Context, signedValue: string): void {
  setCookie(c, 'session', signedValue, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, 'session', { path: '/' })
}

// --- Resolver sesión desde request ---

export async function resolveSession(
  c: Context,
): Promise<{ sessionId: string; session: Session } | null> {
  const cookie = getCookie(c, 'session')
  if (!cookie) return null

  const sessionId = await verifyValue(cookie)
  if (!sessionId) return null

  const session = sessions.get(sessionId)
  if (!session) return null

  return { sessionId, session }
}

// --- Middleware de autenticación ---

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const result = await resolveSession(c)

  if (!result || !result.session.userId) {
    return c.json(
      { error: 'UNAUTHORIZED', message: 'Sesión no válida o expirada' },
      401,
    )
  }

  c.set('userId', result.session.userId)
  c.set('sessionId', result.sessionId)
  c.set('isAnonymous', false)
  await next()
})

// --- Middleware de autenticación opcional (permite anónimos) ---

export const optionalAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const result = await resolveSession(c)

  if (result) {
    if (result.session.anonymous) {
      c.set('sessionId', result.sessionId)
      c.set('isAnonymous', true)
    } else if (result.session.userId) {
      c.set('userId', result.session.userId)
      c.set('sessionId', result.sessionId)
      c.set('isAnonymous', false)
    } else {
      // Sesión inválida (sin userId ni anonymous) — crear anónima
      const anon = await createAnonymousSession()
      setSessionCookie(c, anon.signedValue)
      c.set('sessionId', anon.sessionId)
      c.set('isAnonymous', true)
    }
  } else {
    // Sin sesión — crear sesión anónima
    const anon = await createAnonymousSession()
    setSessionCookie(c, anon.signedValue)
    c.set('sessionId', anon.sessionId)
    c.set('isAnonymous', true)
  }

  await next()
})
