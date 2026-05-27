# UX — Flujos de usuario y reglas de interacción

> Este documento describe **cómo se comporta** la app, no cómo se ve.
> Para tokens visuales, colores y componentes, ver `DESIGN.md`.

---

## Principio de diseño

**Cero fricción.** El usuario debe poder subir un archivo y configurarlo en
menos de 30 segundos sin leer ninguna instrucción. Cada pantalla tiene un
único objetivo claro. Cuando hay duda, la opción más simple gana.

---

## Flujo principal — App cliente

### 1. Primer acceso (usuario nuevo)

```
Abre la URL
    │
    ▼
Pantalla principal (/)
    │
    ├── AnonymousBanner visible (aparece UNA VEZ por sesión, no en recargas)
    │       "Estás en modo anónimo. Tus archivos se perderán si cierras el navegador."
    │       [Crear cuenta]  [Continuar sin cuenta]
    │
    └── UploadZone lista para recibir archivos
```

El usuario puede empezar a subir archivos inmediatamente sin registrarse.
El banner no bloquea la acción, es informativo.

### 2. Subida de un archivo

```
Usuario arrastra un archivo a la UploadZone (o toca para seleccionar)
    │
    ▼
Validación inmediata en cliente:
    ├── Formato válido (PDF, JPG, PNG, TIFF) → continúa
    └── Formato inválido → UploadZone muestra estado de error + texto descriptivo
            "Solo se aceptan PDF, JPG, PNG y TIFF"
            El error desaparece al sacar el archivo de la zona
    │
    ▼
Barra de progreso dentro de la UploadZone durante la subida
    │
    ▼
Al completar: la FileCard aparece al principio de la cola con animación de entrada
La UploadZone vuelve a su estado inicial (lista para otro archivo)
```

**Regla importante:** el usuario puede subir varios archivos seguidos sin esperar.
Cada uno genera su propia FileCard en la cola.

### 3. Configuración de un archivo

La configuración por defecto (A4 · B/N · 1 cara · Normal 90gr) está preseleccionada
y visible en los ConfigChips de la FileCard.

```
Usuario toca una FileCard
    │
    ▼
La tarjeta se expande inline (no modal, no nueva pantalla)
Aparece el PrintConfig Panel con 4 grupos:
    - Tamaño: [A4] A3  A5  A6
    - Color:  [B/N]  Color
    - Caras:  [1 cara]  2 caras
    - Papel:  [Normal 90gr]  Satinado 135gr  Mate 120gr  ...
    │
    ▼
Usuario toca un ConfigChip
    │
    ▼
El chip se activa visualmente (fondo primary, texto blanco)
La configuración se guarda automáticamente via API (PATCH /files/:id/config)
SIN botón de confirmar, SIN toast de confirmación
    │
    ▼
Usuario toca fuera de la tarjeta o la vuelve a tocar → se contrae
Los ConfigChips de la FileCard se actualizan con la nueva configuración
```

**Regla:** la configuración se guarda en cada cambio individual de chip,
no al cerrar el panel. Si hay un error de red al guardar, mostrar un
indicador de error sutil en el chip (borde rojo) sin interrumpir al usuario.

### 4. Eliminar un archivo de la cola

```
Usuario toca el botón de eliminar (X) en una FileCard
    │
    ▼
Sin confirmación previa (la acción es reversible: pueden volver a subir)
La FileCard desaparece con animación de salida
Se llama a DELETE /files/:id en background
```

No hay confirmación modal para eliminar. El volumen de archivos es bajo
y el coste de eliminar por error es mínimo (vuelven a subir).

### 5. Sesión y autenticación

```
Usuario anónimo → usuario autenticado:
    │
    ├── Toca "Crear cuenta" en el AnonymousBanner o el UserSettingsButton
    │       → Navega a /auth/register
    │
    ├── Completa el formulario (email + contraseña)
    │       → POST /auth/register
    │       → Si hay archivos anónimos en sesión → POST /session/convert
    │           (los archivos se migran a la cuenta nueva)
    │       → Redirección a /
    │
    └── Cookie de sesión persistente (sin expiración) guardada en el navegador
```

```
Cerrar sesión (usuario autenticado):
    │
    ├── Toca UserSettingsButton → va a /settings
    ├── Toca "Cerrar sesión"
    ├── POST /auth/logout
    └── Redirección a / (ahora como anónimo, con AnonymousBanner)
```

```
Cerrar sesión (usuario anónimo):
    │
    ├── Toca UserSettingsButton → va a /settings
    ├── Toca "Cerrar sesión"
    ├── Aparece aviso: "Perderás todos tus archivos. ¿Continuar?"
    │   [Cancelar]  [Cerrar sesión]
    └── Si confirma → se eliminan archivos de sesión → redirección a /
```

Esta es la única confirmación modal de la app cliente. Se justifica porque
la pérdida de datos es irreversible.

### 6. Historial y reimprimir

```
/settings → sección "Historial"
    │
    ├── Lista de archivos con estado "impreso"
    │       Nombre · Configuración usada · Fecha de impresión
    │       [Reimprimir]
    │
    └── Usuario toca [Reimprimir]
            → PATCH /files/:id/status con status: 'pending'
            → El archivo aparece de nuevo en la cola de la pantalla principal
            → El usuario ve el archivo en la cola con la configuración original
```

"Reimprimir" no crea una copia del archivo: solo cambia su etiqueta de estado.
El archivo físico sigue siendo el mismo en el servidor.

---

## Flujo — App admin

### 1. Acceso

El admin es desktop-only. No hay pantalla de registro: las credenciales
están en las variables de entorno. Solo existe un formulario de login en `/auth/login`.

### 2. Lista de clientes

```
Pantalla principal /
    │
    ├── Tabla de clientes
    │       Ordenada: primero los que tienen pendientes, luego por fecha
    │       Columnas: Nombre · Email · Pendientes (badge) · Último pedido
    │
    ├── Campo de búsqueda (filtra por nombre o email en tiempo real)
    │
    └── Clic en una fila → navega a /clients/:id
```

### 3. Detalle de cliente y descarga

```
/clients/:id
    │
    ├── Nombre del cliente + email
    │
    ├── Sección "Pendientes de impresión"
    │       Archivos agrupados por configuración (AdminFileGroup)
    │       Un grupo por cada combinación única de parámetros
    │       Cada grupo:
    │           Header: A4 · B/N · 2 caras · Normal 90gr (etiquetas)
    │           Lista: nombre_archivo.pdf (X páginas), ...
    │           [Descargar PDF combinado]
    │
    ├── Al tocar [Descargar PDF combinado]:
    │       → GET /admin/clients/:id/groups/:groupKey/download
    │       → El navegador descarga el PDF
    │       → Todos los archivos del grupo se marcan como "impreso"
    │       → El grupo desaparece de "Pendientes" y aparece en "Impresos"
    │       → Si el grupo era el único, la sección "Pendientes" desaparece
    │
    └── Sección "Ya impresos"
            Lista de archivos impresos con fecha y configuración
            [Reimprimir] por archivo individual → cambia a pending
            [Descargar original] → GET /admin/files/:fileId/original
```

**Regla del dúplex:** cuando el admin descarga un grupo con `sides: 'double'`,
la API ya ha insertado las páginas en blanco necesarias en el PDF combinado.
El admin no necesita hacer nada especial. El PDF está listo para imprimir a doble cara.

---

## Reglas de UX globales

### Errores
- Los errores de validación de formulario aparecen **debajo del campo**, en texto pequeño, en rojo.
- Los errores de red aparecen como **toast** en la esquina inferior central, máximo 4 segundos.
- Los errores de subida de archivo aparecen **dentro de la UploadZone**, no como toast.
- Nunca mostrar mensajes técnicos al usuario (no "500 Internal Server Error").

### Carga
- Las acciones que tardan más de 200ms muestran un indicador de carga.
- La UploadZone muestra barra de progreso real (no fake).
- Los botones de acción se deshabilitan mientras su acción está en curso.

### Estado vacío
- Cola vacía en app cliente: la UploadZone ocupa más espacio + texto "Sube tus archivos para imprimir".
- Sin clientes en admin: texto "No hay clientes registrados todavía."
- Sin pendientes en detalle de cliente: solo se muestra la sección "Ya impresos".

### Navegación
- La app cliente no tiene barra de navegación persistente. El único elemento
  de navegación es el UserSettingsButton (esquina superior derecha).
- La app admin tiene una topbar con el nombre del admin y un botón de logout.
  En la vista de detalle de cliente, un botón "← Volver" a la lista.

### Accesibilidad mínima
- Todos los botones tienen texto descriptivo o `aria-label`.
- Los inputs tienen `label` asociado.
- Los estados de error usan `aria-invalid` y `aria-describedby`.
- El contraste de texto cumple WCAG AA (ya garantizado por los tokens de DESIGN.md).
