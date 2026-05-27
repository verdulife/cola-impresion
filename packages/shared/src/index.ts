// Tipos de dominio — Cola de Impresión

export type FileStatus = 'pending' | 'printed' | 'expired'

export type PrintSize = 'A4' | 'A3' | 'A5' | 'A6'

export type PrintColor = 'bw' | 'color'

export type PrintSides = 'single' | 'double'

export type PrintPaper =
  | 'normal-90'
  | 'satin-135'
  | 'matte-120'
  | 'satin-300'
  | 'matte-300'
  | 'adhesive-matte'
  | 'adhesive-gloss'
  | 'textured-300'

export type PrintConfig = {
  size: PrintSize
  color: PrintColor
  sides: PrintSides
  paper: PrintPaper
}

// Tipos para el motor de agrupación y fusión de PDFs

export type GroupableFile = {
  id: string
  name: string
  storagePath: string
  pageCount: number
  config: PrintConfig
}

export type FileGroup = {
  groupKey: string
  config: PrintConfig
  files: Array<{
    id: string
    name: string
    storagePath: string
    pageCount: number
  }>
  totalPages: number
  note?: string
}
