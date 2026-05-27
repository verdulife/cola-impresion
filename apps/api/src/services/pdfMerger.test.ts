import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { PDFDocument } from 'pdf-lib'
import { groupFilesByConfig, generateCombinedPdf } from './pdfMerger'
import type { GroupableFile, FileGroup, PrintConfig } from '@cola-impresion/shared'

// Directorio temporal aislado para cada ejecución de tests
const TEST_DIR = join(tmpdir(), `cola-impresion-pdfMerger-${Date.now()}-${process.pid}`)

// --- Helpers ---

/** Crea un PDF en memoria con N páginas A4 (595x842). */
async function createTestPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595, 842])
  }
  return doc.save()
}

/** Crea un PDF en memoria con páginas de tamaño personalizado. */
async function createTestPdfWithSizes(sizes: Array<[number, number]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const [w, h] of sizes) {
    doc.addPage([w, h])
  }
  return doc.save()
}

/** Escribe un PDF de prueba en el directorio temporal y devuelve la ruta. */
async function writeTestPdf(name: string, pageCount: number): Promise<string> {
  const data = await createTestPdf(pageCount)
  const filePath = join(TEST_DIR, name)
  await writeFile(filePath, data)
  return filePath
}

/** Escribe bytes raw en el directorio temporal y devuelve la ruta. */
async function writeBytes(name: string, data: Uint8Array): Promise<string> {
  const filePath = join(TEST_DIR, name)
  await writeFile(filePath, data)
  return filePath
}

// --- Configuraciones de prueba ---

const simplexConfig: PrintConfig = { size: 'A4', color: 'bw', sides: 'single', paper: 'normal-90' }
const duplexConfig: PrintConfig = { size: 'A4', color: 'bw', sides: 'double', paper: 'normal-90' }
const colorConfig: PrintConfig = { size: 'A4', color: 'color', sides: 'single', paper: 'normal-90' }

// --- Setup / Teardown ---

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true })
})

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

// ============================================================
// groupFilesByConfig
// ============================================================

describe('groupFilesByConfig', () => {
  test('agrupa archivos con la misma configuración en un único grupo', () => {
    const files: GroupableFile[] = [
      { id: '1', name: 'doc1.pdf', storagePath: '/tmp/doc1.pdf', pageCount: 4, config: simplexConfig },
      { id: '2', name: 'doc2.pdf', storagePath: '/tmp/doc2.pdf', pageCount: 6, config: simplexConfig },
    ]

    const groups = groupFilesByConfig(files)

    expect(groups.size).toBe(1)
    const group = groups.get('A4-bw-single-normal-90')
    expect(group).toBeDefined()
    expect(group!.files).toHaveLength(2)
    expect(group!.totalPages).toBe(10)
  })

  test('archivos con distinta configuración quedan en grupos separados', () => {
    const files: GroupableFile[] = [
      { id: '1', name: 'doc1.pdf', storagePath: '/tmp/doc1.pdf', pageCount: 4, config: simplexConfig },
      { id: '2', name: 'foto.jpg', storagePath: '/tmp/foto.jpg', pageCount: 1, config: colorConfig },
    ]

    const groups = groupFilesByConfig(files)

    expect(groups.size).toBe(2)
    expect(groups.has('A4-bw-single-normal-90')).toBe(true)
    expect(groups.has('A4-color-single-normal-90')).toBe(true)
  })

  test('el formato del groupKey es "size-color-sides-paper"', () => {
    const customConfig: PrintConfig = { size: 'A3', color: 'color', sides: 'double', paper: 'satin-300' }
    const files: GroupableFile[] = [
      { id: '1', name: 'doc.pdf', storagePath: '/tmp/x', pageCount: 1, config: customConfig },
    ]

    const groups = groupFilesByConfig(files)

    expect(groups.has('A3-color-double-satin-300')).toBe(true)
    const group = groups.get('A3-color-double-satin-300')
    expect(group!.groupKey).toBe('A3-color-double-satin-300')
  })

  test('calcula páginas en blanco y nota en modo dúplex con documentos impares', () => {
    const files: GroupableFile[] = [
      { id: '1', name: 'doc1.pdf', storagePath: '/tmp/a', pageCount: 3, config: duplexConfig },
      { id: '2', name: 'doc2.pdf', storagePath: '/tmp/b', pageCount: 5, config: duplexConfig },
    ]

    const groups = groupFilesByConfig(files)
    const group = groups.get('A4-bw-double-normal-90')

    expect(group).toBeDefined()
    // 3 + 5 = 8 reales + 2 blancas = 10
    expect(group!.totalPages).toBe(10)
    expect(group!.note).toBe('2 documentos con páginas impares — se añadirán páginas en blanco')
  })

  test('no añade nota ni páginas extra en dúplex cuando todos los documentos son pares', () => {
    const files: GroupableFile[] = [
      { id: '1', name: 'doc1.pdf', storagePath: '/tmp/a', pageCount: 4, config: duplexConfig },
      { id: '2', name: 'doc2.pdf', storagePath: '/tmp/b', pageCount: 6, config: duplexConfig },
    ]

    const groups = groupFilesByConfig(files)
    const group = groups.get('A4-bw-double-normal-90')

    expect(group!.totalPages).toBe(10)
    expect(group!.note).toBeUndefined()
  })
})

// ============================================================
// generateCombinedPdf
// ============================================================

describe('generateCombinedPdf', () => {
  test('genera un PDF combinado con el número correcto de páginas (simplex)', async () => {
    const path1 = await writeTestPdf('simplex_doc1.pdf', 4)
    const path2 = await writeTestPdf('simplex_doc2.pdf', 6)

    const group: FileGroup = {
      groupKey: 'A4-bw-single-normal-90',
      config: simplexConfig,
      files: [
        { id: '1', name: 'doc1.pdf', storagePath: path1, pageCount: 4 },
        { id: '2', name: 'doc2.pdf', storagePath: path2, pageCount: 6 },
      ],
      totalPages: 10,
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)

    expect(pdf.getPageCount()).toBe(10)
  })

  test('no inserta página en blanco en documentos de páginas pares (modo dúplex)', async () => {
    const path1 = await writeTestPdf('duplex_par1.pdf', 4)
    const path2 = await writeTestPdf('duplex_par2.pdf', 6)

    const group: FileGroup = {
      groupKey: 'A4-bw-double-normal-90',
      config: duplexConfig,
      files: [
        { id: '1', name: 'doc1.pdf', storagePath: path1, pageCount: 4 },
        { id: '2', name: 'doc2.pdf', storagePath: path2, pageCount: 6 },
      ],
      totalPages: 10,
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)

    expect(pdf.getPageCount()).toBe(10)
  })

  test('inserta página en blanco en documentos PDF de páginas impares (modo dúplex)', async () => {
    const path1 = await writeTestPdf('duplex_imp1.pdf', 3)
    const path2 = await writeTestPdf('duplex_imp2.pdf', 5)

    const group: FileGroup = {
      groupKey: 'A4-bw-double-normal-90',
      config: duplexConfig,
      files: [
        { id: '1', name: 'doc1.pdf', storagePath: path1, pageCount: 3 },
        { id: '2', name: 'doc2.pdf', storagePath: path2, pageCount: 5 },
      ],
      totalPages: 10, // 3+1 blanco + 5+1 blanco = 10
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)

    expect(pdf.getPageCount()).toBe(10)
  })

  test('dúplex mixto: inserta blanco solo en el documento impar', async () => {
    const path1 = await writeTestPdf('duplex_mix_par.pdf', 4)
    const path2 = await writeTestPdf('duplex_mix_imp.pdf', 5)

    const group: FileGroup = {
      groupKey: 'A4-bw-double-normal-90',
      config: duplexConfig,
      files: [
        { id: '1', name: 'doc1.pdf', storagePath: path1, pageCount: 4 },
        { id: '2', name: 'doc2.pdf', storagePath: path2, pageCount: 5 },
      ],
      totalPages: 10, // 4 + 5+1 blanco = 10
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)

    expect(pdf.getPageCount()).toBe(10)
  })

  test('no inserta página en blanco en modo simplex con páginas impares', async () => {
    const path1 = await writeTestPdf('simplex_imp1.pdf', 3)
    const path2 = await writeTestPdf('simplex_imp2.pdf', 5)

    const group: FileGroup = {
      groupKey: 'A4-bw-single-normal-90',
      config: simplexConfig,
      files: [
        { id: '1', name: 'doc1.pdf', storagePath: path1, pageCount: 3 },
        { id: '2', name: 'doc2.pdf', storagePath: path2, pageCount: 5 },
      ],
      totalPages: 8,
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)

    // Simplex: NO inserta blancos aunque sean impares
    expect(pdf.getPageCount()).toBe(8)
  })

  test('las páginas aparecen en el orden correcto de los archivos', async () => {
    // Crear PDFs con tamaños de página distintos para verificar el orden
    const data1 = await createTestPdfWithSizes([[100, 200]])
    const path1 = await writeBytes('orden_small.pdf', data1)

    const data2 = await createTestPdfWithSizes([[300, 400]])
    const path2 = await writeBytes('orden_medium.pdf', data2)

    const group: FileGroup = {
      groupKey: 'A4-bw-single-normal-90',
      config: simplexConfig,
      files: [
        { id: '1', name: 'small.pdf', storagePath: path1, pageCount: 1 },
        { id: '2', name: 'medium.pdf', storagePath: path2, pageCount: 1 },
      ],
      totalPages: 2,
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)
    const pages = pdf.getPages()

    expect(pages).toHaveLength(2)
    // Primera página: tamaño del primer archivo (100x200)
    expect(pages[0].getWidth()).toBe(100)
    expect(pages[0].getHeight()).toBe(200)
    // Segunda página: tamaño del segundo archivo (300x400)
    expect(pages[1].getWidth()).toBe(300)
    expect(pages[1].getHeight()).toBe(400)
  })

  test('la página en blanco dúplex tiene el mismo tamaño que la última página del documento', async () => {
    // Crear un PDF de 3 páginas con tamaño no estándar
    const data = await createTestPdfWithSizes([
      [200, 300],
      [200, 300],
      [200, 300],
    ])
    const path = await writeBytes('duplex_custom.pdf', data)

    const group: FileGroup = {
      groupKey: 'A4-bw-double-normal-90',
      config: duplexConfig,
      files: [
        { id: '1', name: 'custom.pdf', storagePath: path, pageCount: 3 },
      ],
      totalPages: 4, // 3 + 1 blanco
    }

    const result = await generateCombinedPdf(group)
    const pdf = await PDFDocument.load(result)
    const pages = pdf.getPages()

    expect(pages).toHaveLength(4)
    // La página 4 (blanca) debe tener el mismo tamaño que la última del documento
    expect(pages[3].getWidth()).toBe(200)
    expect(pages[3].getHeight()).toBe(300)
  })

  test('genera un PDF válido que se puede cargar con pdf-lib', async () => {
    const path = await writeTestPdf('valido.pdf', 2)

    const group: FileGroup = {
      groupKey: 'A4-bw-single-normal-90',
      config: simplexConfig,
      files: [
        { id: '1', name: 'valido.pdf', storagePath: path, pageCount: 2 },
      ],
      totalPages: 2,
    }

    const result = await generateCombinedPdf(group)

    // Verificar que es un Uint8Array
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(0)

    // Verificar que se puede cargar sin error
    const pdf = await PDFDocument.load(result)
    expect(pdf.getPageCount()).toBe(2)
  })
})
