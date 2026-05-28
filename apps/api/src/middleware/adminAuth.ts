import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'

// --- Tipos ---

export type AdminEnv = {
  Variables: {
    adminUser: string
    adminSessionId: string
  }
}

type AdminSession = {
  adminUser: string
  createdAt: number
}

// --- Session store (en memoria, independiente del auth de cliente) ---

const adminSessions = new Map<string, AdminSession>()

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

// --- Firma y verificación con HMAC-SHA256 ---

async function importKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`admin-${SESSION_SECRET}`),
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

// --- Gestión de sesiones admin ---

export async function createAdminSession(adminUser: string): Promise<string> {
  const sessionId = crypto.randomUUID()
  adminSessions.set(sessionId, { adminUser, createdAt: Math.floor(Date.now() / 1000) })
  return signValue(sessionId)
}

export function clearAdminSessions(): void {
  adminSessions.clear()
}

// --- Helpers de cookie ---

const ADMIN_COOKIE_NAME = 'admin_session'

export function setAdminSessionCookie(c: Context, signedValue: string): void {
  setCookie(c, ADMIN_COOKIE_NAME, signedValue, {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
  })
}

export function clearAdminSessionCookie(c: Context): void {
  deleteCookie(c, ADMIN_COOKIE_NAME, { path: '/' })
}

// --- Resolver sesión admin desde request ---

export async function resolveAdminSession(
  c: Context,
): Promise<{ sessionId: string; session: AdminSession } | null> {
  const cookie = getCookie(c, ADMIN_COOKIE_NAME)
  if (!cookie) return null

  const sessionId = await verifyValue(cookie)
  if (!sessionId) return null

  const session = adminSessions.get(sessionId)
  if (!session) return null

  return { sessionId, session }
}

// --- Verificar credenciales admin contra variables de entorno ---

export function verifyAdminCredentials(username: string, password: string): boolean {
  const adminUser = process.env.ADMIN_USER || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'cambiar_en_produccion'
  return username === adminUser && password === adminPassword
}

// --- Middleware de autenticación admin ---

export const adminAuthMiddleware = createMiddleware<AdminEnv>(async (c, next) => {
  const result = await resolveAdminSession(c)

  if (!result) {
    return c.json(
      { error: 'UNAUTHORIZED', message: 'Sesión de admin no válida o expirada' },
      401,
    )
  }

  c.set('adminUser', result.session.adminUser)
  c.set('adminSessionId', result.sessionId)
  await next()
})
