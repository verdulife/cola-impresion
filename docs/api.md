# API — Contrato de endpoints

> Este documento es la **fuente de verdad** del contrato entre frontend y API.
> Cualquier discrepancia entre el código y este documento es un bug.
> Actualizar este documento **antes o durante** la implementación, nunca después.

**Base URL:** `https://api.imprenta.tudominio.com`
**Formato:** JSON en todas las respuestas y cuerpos de petición.
**Autenticación:** Cookie HttpOnly `session` en todas las rutas protegidas.

---

## Estructura de errores

Todos los errores siguen esta estructura:

```json
{
  "error": "ERROR_CODE",
  "message": "Descripción legible para el usuario"
}
```

Códigos de error comunes:

| Código | HTTP | Descripción |
|---|---|---|
| `UNAUTHORIZED` | 401 | Sesión no válida o expirada |
| `FORBIDDEN` | 403 | Sin permisos para esta acción |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `VALIDATION_ERROR` | 400 | Datos de entrada no válidos |
| `FILE_TOO_LARGE` | 400 | Archivo supera el límite de 50MB |
| `INVALID_FILE_TYPE` | 400 | Tipo de archivo no permitido |
| `INTERNAL_ERROR` | 500 | Error interno del servidor |

---

## Auth — `/auth`

### POST /auth/register

Crea una cuenta nueva. Si hay una cookie de sesión anónima activa, los archivos
de esa sesión se migran automáticamente a la cuenta nueva.

**Body:**
```json
{
  "email": "cliente@email.com",
  "password": "contraseña_min_8_chars"
}
```

**Respuesta 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "cliente@email.com",
    "createdAt": 1700000000
  }
}
```

**Errores:** `VALIDATION_ERROR` (email inválido, contraseña < 8 chars),
`409` con código `EMAIL_IN_USE`.

**Efecto secundario:** establece cookie `session` HttpOnly, SameSite=Strict,
sin fecha de expiración.

---

### POST /auth/login

**Body:**
```json
{
  "email": "cliente@email.com",
  "password": "contraseña"
}
```

**Respuesta 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "cliente@email.com",
    "createdAt": 1700000000
  }
}
```

**Errores:** `401` con código `INVALID_CREDENTIALS`.

**Efecto secundario:** establece cookie `session` HttpOnly.

---

### POST /auth/logout

No requiere body. Elimina la cookie de sesión del servidor.

**Respuesta 200:**
```json
{ "ok": true }
```

---

### GET /auth/me

Devuelve el usuario de la sesión activa. Útil para que el frontend determine
si el usuario está autenticado al cargar la app.

**Respuesta 200 (autenticado):**
```json
{
  "user": {
    "id": "uuid",
    "email": "cliente@email.com",
    "createdAt": 1700000000
  },
  "anonymous": false
}
```

**Respuesta 200 (anónimo con sesión):**
```json
{
  "user": null,
  "anonymous": true,
  "sessionId": "uuid"
}
```

**Respuesta 200 (sin sesión):**
```json
{
  "user": null,
  "anonymous": false
}
```

---

## Files — `/files`

> Todas las rutas de `/files` requieren sesión (autenticada o anónima).
> Los usuarios anónimos solo ven y gestionan sus propios archivos de sesión.

### POST /files/upload

Sube un archivo. Multipart form data.

**Body (multipart/form-data):**
- `file`: el archivo (PDF, JPG, PNG, TIFF, máximo 50MB)

**Respuesta 201:**
```json
{
  "file": {
    "id": "uuid",
    "name": "documento.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 245760,
    "pageCount": 12,
    "status": "pending",
    "uploadedAt": 1700000000,
    "expiresAt": 1707776000,
    "config": {
      "size": "A4",
      "color": "bw",
      "sides": "single",
      "paper": "normal-90"
    }
  }
}
```

**Errores:** `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`.

---

### GET /files

Lista todos los archivos de la sesión actual.

**Query params:**
- `status` (opcional): `pending` | `printed` — filtra por estado. Sin param, devuelve todos.

**Respuesta 200:**
```json
{
  "files": [
    {
      "id": "uuid",
      "name": "documento.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 245760,
      "pageCount": 12,
      "status": "pending",
      "uploadedAt": 1700000000,
      "expiresAt": 1707776000,
      "config": {
        "size": "A4",
        "color": "bw",
        "sides": "single",
        "paper": "normal-90"
      }
    }
  ]
}
```

---

### GET /files/:id

Devuelve el detalle de un archivo con su configuración de impresión.

**Respuesta 200:**
```json
{
  "id": "uuid",
  "name": "documento.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245760,
  "pageCount": 12,
  "status": "pending",
  "uploadedAt": 1700000000,
  "expiresAt": 1707776000,
  "config": {
    "size": "A4",
    "color": "bw",
    "sides": "single",
    "paper": "normal-90"
  }
}
```

**Errores:** `NOT_FOUND` (404), `FORBIDDEN` (403 si el archivo no pertenece a la sesión).

---

### PATCH /files/:id/config

Actualiza la configuración de impresión de un archivo. Se puede enviar solo
los campos que cambian (patch parcial).

**Body:**
```json
{
  "size": "A3",
  "color": "color",
  "sides": "double",
  "paper": "satin-135"
}
```

Valores válidos:
- `size`: `"A4"` | `"A3"` | `"A5"` | `"A6"`
- `color`: `"bw"` | `"color"`
- `sides`: `"single"` | `"double"`
- `paper`: `"normal-90"` | `"satin-135"` | `"matte-120"` | `"satin-300"` | `"matte-300"` | `"adhesive-matte"` | `"adhesive-gloss"` | `"textured-300"`

**Respuesta 200:**
```json
{
  "config": {
    "size": "A3",
    "color": "color",
    "sides": "double",
    "paper": "satin-135"
  }
}
```

**Errores:** `NOT_FOUND`, `FORBIDDEN` (el archivo no pertenece a la sesión),
`VALIDATION_ERROR` (valor de parámetro no válido).

---

### PATCH /files/:id/status

Cambia el estado de un archivo (usado para "Reimprimir").

**Body:**
```json
{ "status": "pending" }
```

**Respuesta 200:**
```json
{ "ok": true }
```

---

### DELETE /files/:id

Elimina un archivo de la cola y del servidor.

**Respuesta 200:**
```json
{ "ok": true }
```

**Errores:** `NOT_FOUND`, `FORBIDDEN`.

---

## Session — `/session`

### POST /session/convert

Migra los archivos de una sesión anónima a una cuenta de usuario recién creada.
Se llama internamente desde el registro, no directamente desde el frontend.

**Body:**
```json
{
  "sessionId": "uuid",
  "userId": "uuid"
}
```

**Respuesta 200:**
```json
{
  "migratedFiles": 3
}
```

---

## Admin — `/admin`

> Todas las rutas de `/admin` requieren autenticación con rol `admin`.
> Autenticación vía cookie de sesión con usuario/contraseña de entorno.

### GET /admin/clients

Lista todos los clientes con conteo de archivos pendientes.

**Respuesta 200:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "email": "cliente@email.com",
      "pendingCount": 5,
      "lastActivityAt": 1700000000,
      "createdAt": 1699000000
    }
  ]
}
```

Ordenados: primero los que tienen `pendingCount > 0`, luego por `lastActivityAt` descendente.

---

### GET /admin/clients/:id

Detalle de un cliente con sus archivos agrupados por configuración.

**Respuesta 200:**
```json
{
  "client": {
    "id": "uuid",
    "email": "cliente@email.com",
    "createdAt": 1699000000
  },
  "groups": [
    {
      "groupKey": "A4-bw-double-normal-90",
      "config": {
        "size": "A4",
        "color": "bw",
        "sides": "double",
        "paper": "normal-90"
      },
      "files": [
        {
          "id": "uuid",
          "name": "apuntes.pdf",
          "pageCount": 15,
          "uploadedAt": 1700000000
        }
      ],
      "totalPages": 16,
      "note": "1 documento con páginas impares — se añadirá 1 página en blanco"
    }
  ],
  "printedFiles": [
    {
      "id": "uuid",
      "name": "contrato.pdf",
      "config": { "size": "A4", "color": "bw", "sides": "single", "paper": "normal-90" },
      "printedAt": 1699500000
    }
  ]
}
```

El campo `note` aparece solo cuando hay documentos con número impar de páginas
en grupos de impresión a doble cara.

---

### GET /admin/clients/:id/groups/:groupKey/download

Genera y devuelve el PDF combinado del grupo. Marca todos los archivos del
grupo como `printed` y registra el print_job.

**Respuesta 200:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="grupo_A4-bw-double-normal-90.pdf"`
- Body: el PDF binario

**Errores:** `NOT_FOUND` (cliente o grupo no existe), `FORBIDDEN`.

---

### GET /admin/files/:fileId/original

Descarga el archivo original tal como fue subido por el cliente.

**Respuesta 200:**
- Content-Type: el mime type original del archivo
- Content-Disposition: `attachment; filename="{nombre_original}"`
- Body: el archivo binario

---

### PATCH /admin/files/:fileId/status

Cambia el estado de un archivo manualmente (para gestionar errores de impresión).

**Body:**
```json
{ "status": "pending" }
```

**Respuesta 200:**
```json
{ "ok": true }
```
