---
version: alpha
name: Cola de Impresión
description: >
  Sistema de diseño para la plataforma web de gestión de pedidos de imprenta.
  Mobile-first, cero fricción, dos apps: cliente (web) y operario (admin).

colors:
  primary: "#1A1A2E"
  secondary: "#16213E"
  accent: "#E63946"
  accent-hover: "#C1121F"
  surface: "#FFFFFF"
  surface-raised: "#F8F9FA"
  surface-sunken: "#F1F3F5"
  border: "#DEE2E6"
  border-subtle: "#E9ECEF"
  text-primary: "#1A1A2E"
  text-secondary: "#6C757D"
  text-disabled: "#ADB5BD"
  text-on-accent: "#FFFFFF"
  text-on-dark: "#FFFFFF"
  success: "#2D6A4F"
  success-surface: "#D8F3DC"
  warning: "#E76F51"
  warning-surface: "#FFF3E0"
  error: "#C1121F"
  error-surface: "#FFE5E5"
  info: "#457B9D"
  info-surface: "#E8F4FD"
  status-pending: "#E76F51"
  status-printed: "#2D6A4F"
  status-anonymous: "#ADB5BD"

typography:
  display:
    fontFamily: "Inter"
    fontSize: "2rem"
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Inter"
    fontSize: "1.5rem"
    fontWeight: "700"
    lineHeight: "1.3"
    letterSpacing: "-0.01em"
  h2:
    fontFamily: "Inter"
    fontSize: "1.25rem"
    fontWeight: "600"
    lineHeight: "1.4"
  h3:
    fontFamily: "Inter"
    fontSize: "1rem"
    fontWeight: "600"
    lineHeight: "1.5"
  body-lg:
    fontFamily: "Inter"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: "Inter"
    fontSize: "0.875rem"
    fontWeight: "400"
    lineHeight: "1.6"
  body-sm:
    fontFamily: "Inter"
    fontSize: "0.75rem"
    fontWeight: "400"
    lineHeight: "1.5"
  label:
    fontFamily: "Inter"
    fontSize: "0.75rem"
    fontWeight: "600"
    lineHeight: "1.4"
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: "400"
    lineHeight: "1.5"

rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"

spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"

components:
  upload-zone:
    background: "{colors.surface-sunken}"
    border: "2px dashed {colors.border}"
    border-active: "2px dashed {colors.accent}"
    background-active: "{colors.error-surface}"
    rounded: "{rounded.xl}"
    aspect-ratio: "1 / 1"
  file-card:
    background: "{colors.surface}"
    border: "1px solid {colors.border-subtle}"
    rounded: "{rounded.lg}"
    shadow: "0 1px 3px rgba(0,0,0,0.08)"
  config-chip:
    background: "{colors.surface-raised}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.full}"
    background-active: "{colors.primary}"
    color-active: "{colors.text-on-dark}"
  button-primary:
    background: "{colors.accent}"
    background-hover: "{colors.accent-hover}"
    color: "{colors.text-on-accent}"
    rounded: "{rounded.md}"
  button-ghost:
    background: "transparent"
    border: "1px solid {colors.border}"
    color: "{colors.text-primary}"
    rounded: "{rounded.md}"
  badge-pending:
    background: "{colors.warning-surface}"
    color: "{colors.warning}"
    rounded: "{rounded.full}"
  badge-printed:
    background: "{colors.success-surface}"
    color: "{colors.success}"
    rounded: "{rounded.full}"
  admin-row:
    background: "{colors.surface}"
    background-hover: "{colors.surface-raised}"
    border-bottom: "1px solid {colors.border-subtle}"
---

## Overview

Cola de Impresión es una herramienta de trabajo, no una app de consumo. El
diseño debe proyectar **confianza, claridad y eficiencia**. Nada de gradientes
decorativos, animaciones innecesarias ni elementos que compitan con el contenido.

El tono visual es **profesional y limpio**: fondo blanco, tipografía negra,
un único color de acento (rojo) reservado exclusivamente para acciones
primarias y estados de atención. El rojo conecta visualmente con la identidad
de la imprenta (tinta, urgencia, precisión).

La jerarquía visual en la app cliente tiene una regla fija: **la zona de subida
de archivos siempre manda**. Todo lo demás es secundario.

---

## Colors

- **Primary (#1A1A2E):** Azul casi negro. Texto principal, cabeceras, elementos de navegación. Transmite seriedad y permanencia.
- **Accent (#E63946):** Rojo imprenta. Uso exclusivo: botones de acción primaria, indicadores de estado de atención, borde activo de la zona de subida. Nunca decorativo.
- **Surface (#FFFFFF):** Fondo base de todas las pantallas y tarjetas.
- **Surface-raised (#F8F9FA):** Fondo de tarjetas elevadas y filas alternas en tablas. Diferencia sutil sin sombras pesadas.
- **Surface-sunken (#F1F3F5):** Fondo de la zona de subida en estado inactivo. Invita a depositar contenido.
- **Border (#DEE2E6):** Líneas divisorias y bordes de inputs. Siempre sutil.
- **Text-secondary (#6C757D):** Metadatos, fechas, etiquetas de configuración. Nunca para contenido crítico.
- **Success (#2D6A4F) / Warning (#E76F51) / Error (#C1121F):** Estados de feedback. Siempre acompañados de texto, nunca solo color.
- **Status-pending (#E76F51):** Archivos en espera de impresión.
- **Status-printed (#2D6A4F):** Archivos ya impresos.

---

## Typography

La fuente es **Inter** en todos los contextos. Es legible a tamaños pequeños,
gratuita, y funciona bien en pantallas de baja resolución (móviles de gama media).
`JetBrains Mono` solo para referencias técnicas como IDs de pedido o rutas.

Jerarquía en uso:
- `display`: nombre del servicio en la pantalla de bienvenida únicamente.
- `h1`: título de sección por pantalla (uno por pantalla máximo).
- `h2`: nombre del cliente en el panel admin, nombre de archivo en tarjeta.
- `h3`: etiquetas de grupo de configuración.
- `body-lg`: descripción principal, instrucciones al usuario.
- `body-md`: contenido estándar, listas, metadatos de archivo.
- `body-sm`: fechas, contadores, texto de apoyo.
- `label`: etiquetas de campo UPPERCASE con tracking amplio.

---

## Layout & Breakpoints

El diseño es **mobile-first**. El breakpoint base es para pantallas de 390px
(iPhone 14). Las variaciones son:

- `sm`: 640px — tablet vertical, ajustes menores de padding.
- `md`: 768px — tablet horizontal, posibles layouts de dos columnas.
- `lg`: 1024px — escritorio, layout completo de la app admin.

**Regla fija de la app cliente:** no hay scroll global en la página principal.
La zona de subida ocupa todo el ancho con aspect-ratio 1:1 en móvil. El módulo
de cola de archivos tiene su propio scroll interno. Estos dos módulos deben
caber siempre en el viewport sin scroll de página.

---

## Components

### UploadZone
El componente más importante de la app. Ocupa el 100% del ancho disponible con
aspect-ratio 1:1 en móvil. Fondo `surface-sunken`, borde punteado `border`.
Al arrastrar un archivo encima: borde cambia a `accent`, fondo a `error-surface`
(rojo muy suave). En el centro: icono de subida + texto "Arrastra tus archivos
aquí o toca para seleccionar". Sin ningún otro elemento dentro.

### FileCard
Tarjeta de archivo en la cola de impresión. Contiene: icono de tipo de archivo
(PDF/imagen), nombre del archivo truncado con ellipsis, chips de configuración
(tamaño, color, caras, papel) y botón de eliminar. Altura fija para que la lista
sea escaneable. Al tocar la tarjeta se expande inline para editar la configuración.

### ConfigChip
Pastilla de configuración. Estado inactivo: fondo `surface-raised`, borde
`border`, texto `text-secondary`. Estado activo/seleccionado: fondo `primary`,
texto blanco. Nunca usar color `accent` en chips: el rojo es solo para acciones
destructivas o de atención.

### PrintConfig Panel
Aparece al expandir una FileCard. Cuatro grupos de opciones: Tamaño (A4, A3,
A5, A6), Color (B/N, Color), Caras (1 cara, 2 caras), Papel (5 opciones). Cada
grupo usa ConfigChips en fila con scroll horizontal si no caben. Solo una opción
activa por grupo. La configuración se guarda automáticamente al seleccionar, sin
botón de confirmar.

### UserSettingsButton
Botón fijo en la esquina superior derecha (móvil) o en la barra de navegación
superior (escritorio). Icono de persona + indicador de sesión (verde si autenticado,
gris si anónimo con tooltip "Sesión anónima — el historial no se guardará"). Al
tocar navega a la página de ajustes/historial.

### AnonymousBanner
Banner no intrusivo (no modal, no overlay) que aparece una sola vez por sesión
para usuarios anónimos. Texto: "Estás en modo anónimo. Tus archivos se perderán
si cierras el navegador." Acción: "Crear cuenta" (link) y "Continuar sin cuenta"
(cierra el banner). Posición: debajo del header, encima de la UploadZone.

### AdminClientRow
Fila de cliente en el panel admin. Contiene: nombre del cliente, email, número
de archivos pendientes (badge naranja), fecha del último pedido. Al hacer clic
navega al detalle del cliente. Fila completa es clickable.

### AdminFileGroup
Bloque de archivos agrupados por configuración de impresión en el panel admin.
Header del grupo: etiquetas de configuración (A4 · B/N · 2 caras · Normal 90gr).
Contenido: lista de archivos incluidos en el grupo con nombre y número de páginas.
Footer: botón "Descargar PDF combinado" (acción primaria).

---

## Spacing & Density

La densidad de la UI es **media-alta**: información densa pero no agobiante.
En móvil el padding horizontal de pantalla es `spacing.4` (16px). Las tarjetas
tienen padding interno de `spacing.4`. La separación entre tarjetas en la cola
es `spacing.3` (12px). En escritorio (admin) el padding de pantalla sube a
`spacing.8` (32px).

---

## States & Feedback

Toda acción del usuario recibe feedback visual inmediato:
- **Subida de archivo:** barra de progreso dentro de la UploadZone mientras sube.
- **Guardado de configuración:** chip animado brevemente al seleccionar (sin toast).
- **Error de formato:** la UploadZone muestra estado de error con texto descriptivo.
- **Archivo procesado:** la FileCard aparece en la cola con animación de entrada suave.

Los toasts se reservan para errores de red y confirmaciones de acciones críticas
(archivo eliminado, sesión cerrada). Máximo un toast visible a la vez.
