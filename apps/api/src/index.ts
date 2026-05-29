import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { runMigrations } from './db/migrate'
import authRoutes from './routes/auth'
import fileRoutes from './routes/files'
import adminRoutes from './routes/admin'
import sessionRoutes from './routes/session'

// Aplicar migraciones al arrancar
runMigrations()

export const app = new Hono()

app.use('*', cors({
	origin: (process.env.ALLOWED_ORIGIN || 'http://localhost:5173'),
	credentials: true,
}))

app.get('/', (c) => {
  return c.json({ status: 'ok' })
})

// Rutas de autenticación
app.route('/auth', authRoutes)

// Rutas de archivos
app.route('/files', fileRoutes)

// Rutas de admin
app.route('/admin', adminRoutes)

// Rutas de sesión anónima
app.route('/session', sessionRoutes)

const port = Number(process.env.PORT) || 3001

console.log(`API listening on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
