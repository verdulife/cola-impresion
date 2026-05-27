import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('client'),
  createdAt: integer('created_at').notNull(),
})

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  sessionId: text('session_id'),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  pageCount: integer('page_count').notNull(),
  status: text('status').notNull().default('pending'),
  uploadedAt: integer('uploaded_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
})

export const printConfigs = sqliteTable('print_configs', {
  id: text('id').primaryKey(),
  fileId: text('file_id')
    .notNull()
    .unique()
    .references(() => files.id, { onDelete: 'cascade' }),
  size: text('size').notNull().default('A4'),
  color: text('color').notNull().default('bw'),
  sides: text('sides').notNull().default('single'),
  paper: text('paper').notNull().default('normal-90'),
  updatedAt: integer('updated_at').notNull(),
})

export const printJobs = sqliteTable('print_jobs', {
  id: text('id').primaryKey(),
  adminId: text('admin_id')
    .notNull()
    .references(() => users.id),
  groupKey: text('group_key').notNull(),
  clientId: text('client_id')
    .notNull()
    .references(() => users.id),
  downloadedAt: integer('downloaded_at'),
  createdAt: integer('created_at').notNull(),
})

export const printJobFiles = sqliteTable(
  'print_job_files',
  {
    jobId: text('job_id')
      .notNull()
      .references(() => printJobs.id),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.fileId] })],
)

// Tipos inferidos para uso en la aplicación
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert

export type PrintConfig = typeof printConfigs.$inferSelect
export type NewPrintConfig = typeof printConfigs.$inferInsert

export type PrintJob = typeof printJobs.$inferSelect
export type NewPrintJob = typeof printJobs.$inferInsert

export type PrintJobFile = typeof printJobFiles.$inferSelect
export type NewPrintJobFile = typeof printJobFiles.$inferInsert
