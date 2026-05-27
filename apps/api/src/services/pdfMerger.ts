import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'
import type { PrintConfig, GroupableFile, FileGroup } from '@cola-impresion/shared'

/**
 * Construye la clave de agrupación a partir de una configuración de impresión.
 * Formato: "size-color-sides-paper" (ej: "A4-bw-double-normal-90")
 */
function buildGroupKey(config: PrintConfig): string {
  return `${config.size}-${config.color}-${config.sides}-${config.paper}`
}

/**
 * Agrupa archivos por combinación exacta de parámetros de impresión.
 * Devuelve un Map donde la clave es el groupKey y el valor es el grupo.
 *
 * En modo dúplex (sides=double), calcula cuántos documentos tienen páginas
 * impares y lo refleja en totalPages y en la nota del grupo.
 */
export function groupFilesByConfig(files: GroupableFile[]): Map<string, FileGroup> {
  const groups = new Map<string, FileGroup>()

  for (const file of files) {
    const key = buildGroupKey(file.config)

    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        config: file.config,
        files: [],
        totalPages: 0,
      })
    }

    const group = groups.get(key)!
    group.files.push({
      id: file.id,
      name: file.name,
      storagePath: file.storagePath,
      pageCount: file.pageCount,
    })
    group.totalPages += file.pageCount
  }

  // Calcular páginas en blanco necesarias para dúplex y actualizar nota
  for (const group of groups.values()) {
    if (group.config.sides === 'double') {
      const oddCount = group.files.filter((f) => f.pageCount % 2 !== 0).length
      if (oddCount > 0) {
        group.note = `${oddCount} documentos con páginas impares — se añadirán páginas en blanco`
        group.totalPages += oddCount
      }
    }
  }

  return groups
}

/**
 * Devuelve la extensión del archivo en minúsculas (incluyendo el punto).
 */
function getExtension(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot >= 0 ? path.slice(dot).toLowerCase() : ''
}

/**
 * Genera un PDF combinado a partir de los archivos de un grupo.
 *
 * - Para archivos PDF: extrae todas las páginas y las añade al PDF combinado.
 * - Para imágenes (JPG, PNG): las incrusta como una página completa centrada en A4.
 * - Regla dúplex: si config.sides === 'double', inserta una página en blanco
 *   después de cada documento con número impar de páginas. La página en blanco
 *   tiene el mismo tamaño que la última página del documento.
 *
 * El PDF combinado NO se persiste en disco — se genera al vuelo.
 */
export async function generateCombinedPdf(group: FileGroup): Promise<Uint8Array> {
  const combinedDoc = await PDFDocument.create()
  const isDuplex = group.config.sides === 'double'

  for (const file of group.files) {
    const fileData = await readFile(file.storagePath)
    const ext = getExtension(file.storagePath)
    let pagesAdded = 0

    if (ext === '.pdf') {
      const srcDoc = await PDFDocument.load(fileData)
      const copiedPages = await combinedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
      for (const page of copiedPages) {
        combinedDoc.addPage(page)
        pagesAdded++
      }
    } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      const image =
        ext === '.png'
          ? await combinedDoc.embedPng(fileData)
          : await combinedDoc.embedJpg(fileData)

      // Página A4 por defecto (595.28 x 841.89 puntos)
      const page = combinedDoc.addPage([595.28, 841.89])
      const { width, height } = page.getSize()

      // Escalar imagen para que quepa centrada en la página
      const imgDims = image.scaleToFit(width, height)
      page.drawImage(image, {
        x: (width - imgDims.width) / 2,
        y: (height - imgDims.height) / 2,
        width: imgDims.width,
        height: imgDims.height,
      })
      pagesAdded = 1
    } else {
      throw new Error(`Formato de archivo no soportado: ${ext}`)
    }

    // Regla dúplex: insertar página en blanco si el documento tiene páginas impares
    if (isDuplex && pagesAdded % 2 !== 0) {
      const allPages = combinedDoc.getPages()
      const lastPage = allPages[allPages.length - 1]
      const { width, height } = lastPage.getSize()
      combinedDoc.addPage([width, height])
    }
  }

  return combinedDoc.save()
}
