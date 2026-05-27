import { db } from './index'
import { users, files, printConfigs } from './schema'
import { runMigrations } from './migrate'

async function seed(): Promise<void> {
  // Asegurar que la DB está al día
  runMigrations()

  console.log('Cargando datos de prueba...')

  const now = Math.floor(Date.now() / 1000)
  const ninetyDays = 90 * 24 * 60 * 60

  // Crear usuarios de prueba
  const userId1 = crypto.randomUUID()
  const userId2 = crypto.randomUUID()

  const passwordHash1 = await Bun.password.hash('password123')
  const passwordHash2 = await Bun.password.hash('password456')

  db.insert(users)
    .values([
      {
        id: userId1,
        email: 'cliente@ejemplo.com',
        passwordHash: passwordHash1,
        role: 'client',
        createdAt: now,
      },
      {
        id: userId2,
        email: 'admin@ejemplo.com',
        passwordHash: passwordHash2,
        role: 'admin',
        createdAt: now,
      },
    ])
    .run()

  console.log(`  Usuarios creados: ${userId1}, ${userId2}`)

  // Crear archivos de prueba
  const fileIds: string[] = []
  const fileData = [
    { name: 'documento.pdf', mime: 'application/pdf', pages: 5, size: 102400 },
    { name: 'foto.jpg', mime: 'image/jpeg', pages: 1, size: 204800 },
    { name: 'presentacion.pdf', mime: 'application/pdf', pages: 12, size: 512000 },
    { name: 'contrato.pdf', mime: 'application/pdf', pages: 3, size: 81920 },
    { name: 'imagen.png', mime: 'image/png', pages: 1, size: 307200 },
    { name: 'informe.pdf', mime: 'application/pdf', pages: 8, size: 409600 },
  ]

  for (let i = 0; i < fileData.length; i++) {
    const fileId = crypto.randomUUID()
    fileIds.push(fileId)
    const f = fileData[i]
    const userId = i < 4 ? userId1 : userId2

    db.insert(files)
      .values({
        id: fileId,
        userId,
        filename: `${fileId}_${f.name}`,
        originalName: f.name,
        storagePath: `storage/uploads/${userId}/${fileId}_${f.name}`,
        mimeType: f.mime,
        sizeBytes: f.size,
        pageCount: f.pages,
        status: 'pending',
        uploadedAt: now,
        expiresAt: now + ninetyDays,
      })
      .run()
  }

  console.log(`  Archivos creados: ${fileIds.length}`)

  // Crear print_configs para cada archivo
  const configVariants = [
    { size: 'A4', color: 'bw', sides: 'single', paper: 'normal-90' },
    { size: 'A4', color: 'color', sides: 'double', paper: 'satin-135' },
    { size: 'A3', color: 'bw', sides: 'single', paper: 'normal-90' },
    { size: 'A4', color: 'bw', sides: 'double', paper: 'matte-120' },
    { size: 'A5', color: 'color', sides: 'single', paper: 'normal-90' },
    { size: 'A4', color: 'bw', sides: 'single', paper: 'normal-90' },
  ]

  for (let i = 0; i < fileIds.length; i++) {
    const config = configVariants[i]
    db.insert(printConfigs)
      .values({
        id: crypto.randomUUID(),
        fileId: fileIds[i],
        size: config.size,
        color: config.color,
        sides: config.sides,
        paper: config.paper,
        updatedAt: now,
      })
      .run()
  }

  console.log(`  Configuraciones de impresión creadas: ${fileIds.length}`)
  console.log('Seed completado.')
}

seed().catch((err) => {
  console.error('Error en seed:', err)
  process.exit(1)
})
