## Implementación feature 6: Motor de agrupación y generación del PDF combinado

### Archivos creados / modificados

- `packages/shared/src/index.ts` — Añadidos tipos `GroupableFile` y `FileGroup` para el motor de agrupación
- `apps/api/src/services/pdfMerger.ts` — Servicio de agrupación y fusión de PDFs con dos funciones exportadas:
  - `groupFilesByConfig()` — Agrupa archivos por combinación exacta de parámetros de impresión
  - `generateCombinedPdf()` — Genera el PDF combinado al vuelo leyendo archivos desde disco
- `apps/api/src/services/pdfMerger.test.ts` — 13 tests exhaustivos del motor (5 de agrupación + 8 de generación)

### Decisiones tomadas

1. **Imágenes soportadas: JPG y PNG.** pdf-lib no soporta TIFF nativamente. Se incrustan imágenes JPG/PNG centradas en una página A4 (595.28 x 841.89 puntos), escaladas con `scaleToFit` para mantener proporción. Si en el futuro se necesita TIFF, requerirá una librería de conversión previa (ej. sharp).

2. **Página en blanco dúplex con tamaño heredado.** La página en blanco insertada tras un documento impar hereda el tamaño de la última página de ese documento (no un A4 fijo). Esto es importante para documentos con tamaños de página mixtos.

3. **Tests con archivos reales en directorio temporal.** Los tests escriben PDFs de prueba en un directorio temporal del SO (`os.tmpdir()`) con nombre único por ejecución (incluye `Date.now()` y `process.pid`). Se limpia automáticamente en `afterAll`. Esto permite que `generateCombinedPdf` lea de disco como en producción.

4. **Verificación de orden mediante tamaños de página.** Para verificar que las páginas aparecen en el orden correcto, se crean PDFs con tamaños de página distintos (100x200 y 300x400) y se comprueba que el PDF combinado respeta el orden.

5. **totalPages incluye páginas en blanco.** En `groupFilesByConfig`, cuando `sides=double`, el campo `totalPages` del grupo ya incluye las páginas en blanco que se insertarán. Esto permite al admin saber el total real de páginas antes de generar el PDF.

6. **TS6059 documentado.** El type-check con `tsc --noEmit` muestra un error TS6059 porque el path alias `@cola-impresion/shared` apunta fuera de `rootDir`. Este error es consistente con la configuración actual del tsconfig y no afecta al build de bun ni a los tests. Se puede resolver en una feature futura ajustando el tsconfig (quitando `rootDir` o añadiendo `composite`).

### Tests añadidos

**groupFilesByConfig (5 tests):**
1. `agrupa archivos con la misma configuración en un único grupo` — 2 PDFs misma config → 1 grupo, 10 páginas
2. `archivos con distinta configuración quedan en grupos separados` — PDF + imagen con distinta config → 2 grupos
3. `el formato del groupKey es "size-color-sides-paper"` — Verifica "A3-color-double-satin-300"
4. `calcula páginas en blanco y nota en modo dúplex con documentos impares` — 3p+5p dúplex → 10 totalPages + nota
5. `no añade nota ni páginas extra en dúplex cuando todos los documentos son pares` — 4p+6p dúplex → 10 totalPages, sin nota

**generateCombinedPdf (8 tests):**
6. `genera un PDF combinado con el número correcto de páginas (simplex)` — 4p+6p → 10 páginas
7. `no inserta página en blanco en documentos de páginas pares (modo dúplex)` — 4p+6p dúplex → 10 páginas
8. `inserta página en blanco en documentos PDF de páginas impares (modo dúplex)` — 3p+5p dúplex → 10 páginas (3+1+5+1)
9. `dúplex mixto: inserta blanco solo en el documento impar` — 4p+5p dúplex → 10 páginas (4+5+1)
10. `no inserta página en blanco en modo simplex con páginas impares` — 3p+5p simplex → 8 páginas (sin blancos)
11. `las páginas aparecen en el orden correcto de los archivos` — Verifica orden con tamaños de página distintos
12. `la página en blanco dúplex tiene el mismo tamaño que la última página del documento` — PDF custom 200x300 → blanco 200x300
13. `genera un PDF válido que se puede cargar con pdf-lib` — Verifica que el output es Uint8Array válido

### Verificación ejecutada

- `bun test` → **44 tests pasan** (31 existentes + 13 nuevos), 0 fallos ✅
- `bun test src/services/pdfMerger.test.ts` → **13 tests pasan**, 0 fallos ✅
- `bun run build` → **compila sin errores** (321 módulos, 135ms) ✅
- `./init.sh` → error de entorno (bun no está en PATH de bash), no relacionado con la feature

### Listo para revisión: SÍ
