# Sesión activa

> Vacío = sin sesión activa. Rellena este archivo al empezar a trabajar
> y mueve su contenido a `history.md` al cerrar la sesión.

---

## Feature en progreso

<!-- Ejemplo:
**ID:** 3
**Título:** Autenticación: registro y login con cookie persistente
**App:** api
**Inicio:** 2025-11-15 10:30
-->

**ID:**
**Título:**
**App:**
**Inicio:**

---

## Plan de la sesión

<!-- Lista de pasos concretos que vas a seguir para implementar esta feature -->

1.
2.
3.

---

## Decisiones tomadas

- Auth admin independiente: cookie `admin_session` separada, sesiones en Map propio, HMAC con prefijo "admin-"
- Admin system user (ID='admin') para FK constraint en print_jobs.admin_id
- Nota dúplex generada en handler para coincidir con contrato API (singular/plural)
- printedAt usa uploadedAt como fallback para archivos marcados manualmente

---

## Bloqueos / pendientes

- Ninguno. Feature completa.

---

## Archivos modificados

- `apps/api/src/middleware/adminAuth.ts` — creado
- `apps/api/src/routes/admin.ts` — creado
- `apps/api/src/routes/admin.test.ts` — creado
- `apps/api/src/index.ts` — modificado (registro de rutas admin)
- `progress/impl_7.md` — creado (informe de implementación)
