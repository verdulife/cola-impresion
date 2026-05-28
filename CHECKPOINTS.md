# CHECKPOINTS — Criterios de estado final correcto

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos checkpoints son objetivos y verificables. Un agente revisor los recorre
> uno a uno y rechaza el cierre de sesión si queda alguno sin cumplir.

---

## C1 — El arnés está completo y operativo

- [ ] Existen todos los archivos base: `AGENTS.md`, `CHECKPOINTS.md`, `DESIGN.md`,
      `feature_list.json`, `init.sh`, `init.ps1`, `progress/current.md`, `progress/history.md`.
- [ ] Existen todos los docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/ux.md`, `docs/api.md`, `docs/infrastructure.md`, `docs/verification.md`.
- [ ] Existen las definiciones de agentes: `.opencode/agents/leader.md`,
      `.opencode/agents/implementer.md`, `.opencode/agents/reviewer.md`.
- [ ] `./init.sh` (Linux/macOS) o `./init.ps1` (Windows) termina con exit code 0 y sin errores.

---

## C2 — El estado es coherente

- [ ] Como mucho **una** feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature marcada `done` tiene tests que pasan en su app correspondiente.
- [ ] `progress/current.md` está vacío (plantilla) o describe la sesión activa,
      no contiene basura de sesiones anteriores.
- [ ] No hay discrepancia entre el estado en `feature_list.json` y lo que existe
      realmente en el código.

---

## C3 — El código respeta la arquitectura

- [ ] Cada archivo nuevo está en la app correcta (`apps/web`, `apps/admin`, `apps/api`
      o `packages/shared`), según `docs/architecture.md`.
- [ ] Los tipos compartidos entre apps están en `packages/shared`, no duplicados.
- [ ] No hay lógica de negocio en componentes de UI (va en `+page.server.ts` o en la API).
- [ ] No hay llamadas directas a la base de datos desde el frontend.
- [ ] No hay `console.log` sueltos de debug.
- [ ] No hay TODOs sin contexto ni archivos temporales.

---

## C4 — El código respeta el diseño

- [ ] Todos los valores de color, tipografía y espaciado vienen de los tokens
      definidos en `DESIGN.md`, nunca hardcodeados.
- [ ] Los componentes de UI siguen los patrones descritos en `DESIGN.md`
      (sección Components).
- [ ] La UI es mobile-first: el diseño base es para móvil, las variantes para
      tablet/escritorio se añaden con breakpoints.
- [ ] No hay scroll global en la app cliente: solo el módulo de cola tiene
      scroll propio.

---

## C5 — El contrato de API se respeta

- [ ] Todo endpoint nuevo está documentado en `docs/api.md` antes o durante
      su implementación, nunca después.
- [ ] Los payloads y respuestas del código coinciden exactamente con lo
      definido en `docs/api.md`.
- [ ] La autenticación está presente en todos los endpoints que la requieren.
- [ ] Los archivos subidos se validan (tipo y tamaño) antes de procesarse.

---

## C6 — La verificación es real

- [ ] Existen tests para la lógica nueva implementada.
- [ ] Los tests de la API prueban el endpoint real, no mocks de la lógica interna.
- [ ] El agrupador de PDFs tiene tests con casos de: documentos par, documentos
      impar (deben añadir página en blanco), y múltiples clientes en el mismo lote.
- [ ] `./init.sh` (o `./init.ps1` en Windows) muestra todos los tests en verde.

---

## C7 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`*.tmp`, `node_modules` fuera
      de lugar, `.env` comiteado).
- [ ] `progress/history.md` tiene una entrada por la última sesión completada.
- [ ] La última feature trabajada está en su estado correcto en `feature_list.json`.
- [ ] El repositorio compila sin errores (`bun run build` en cada app modificada).

---

**Cómo usar este archivo:** el agente revisor (`.opencode/agents/reviewer.md`)
recorre cada checkbox, marca `[x]` o `[ ]`, y rechaza el cierre de sesión si
quedan boxes sin marcar en C1–C7.
