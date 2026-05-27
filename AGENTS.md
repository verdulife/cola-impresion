# AGENTS.md — Mapa de navegación para agentes de IA

> Este archivo es el **punto de entrada** para cualquier agente que trabaje en
> este repositorio. NO es una biblia de reglas: es un **mapa**. Lee solo lo que
> necesites cuando lo necesites (divulgación progresiva).

---

## 1. Antes de empezar (obligatorio)

1. Ejecuta `./init.sh` y verifica que termina sin errores. Si falla, **para**
   y resuelve el problema antes de tocar código.
2. Lee `progress/current.md` para entender en qué estado quedó la última sesión.
3. Lee `feature_list.json` y elige **una** tarea con estado `pending`. No
   trabajes en más de una a la vez.

---

## 2. Mapa del repositorio

| Archivo / carpeta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `feature_list.json` | Lista de features con estado (pending / in_progress / done) | Siempre, al empezar |
| `progress/current.md` | Estado de la sesión activa | Siempre, al empezar |
| `progress/history.md` | Bitácora append-only de sesiones anteriores | Si necesitas contexto histórico |
| `DESIGN.md` | Tokens de diseño, paleta, tipografía y componentes visuales | Antes de tocar cualquier archivo de UI |
| `docs/architecture.md` | Estructura técnica, stack, monorepo y relación entre apps | Antes de implementar cualquier feature |
| `docs/conventions.md` | Estilo de código, nombres, estructura de carpetas, patrones | Antes de escribir código |
| `docs/ux.md` | Flujos de usuario, reglas de interacción y comportamiento de la UI | Antes de implementar features de frontend |
| `docs/api.md` | Contrato de endpoints entre frontend y API Bun | Antes de implementar llamadas a la API o nuevos endpoints |
| `docs/infrastructure.md` | Docker, volúmenes, variables de entorno y entorno local | Antes de tocar configuración de servidor |
| `docs/verification.md` | Cómo verificar que una feature funciona correctamente | Antes de declarar una tarea como `done` |
| `CHECKPOINTS.md` | Criterios objetivos de "estado final correcto" | Para autoevaluarte antes de cerrar sesión |
| `.opencode/agents/` | Definiciones de subagentes (líder, implementador, revisor) | Si orquestas trabajo con subagentes |

---

## 3. Estructura del monorepo

```
cola-impresion/
├── apps/
│   ├── web/          # App cliente (SvelteKit) → desplegada en Vercel
│   ├── admin/        # App admin (SvelteKit) → desplegada en Vercel
│   └── api/          # API Bun → desplegada en servidor propio (Docker)
├── packages/
│   └── shared/       # Tipos TypeScript compartidos entre apps
├── docs/             # Documentación para agentes
├── progress/         # Estado de sesiones
├── .opencode/        # Configuración de agentes opencode
├── AGENTS.md         # Este archivo
├── CHECKPOINTS.md    # Criterios de verificación
├── DESIGN.md         # Sistema de diseño
├── feature_list.json # Lista de features
└── init.sh           # Script de verificación del entorno
```

---

## 4. Reglas duras (no negociables)

- **Una sola feature a la vez.** No mezcles cambios de varias tareas en la misma sesión.
- **No declares una tarea `done` sin verificación real.** Ejecuta `./init.sh` y comprueba que todo pasa.
- **Documenta mientras trabajas**, no al final. Escribe en `progress/current.md` a medida que avanzas.
- **Lee DESIGN.md antes de cualquier UI.** Nunca inventes colores, tipografías o espaciados.
- **Lee docs/api.md antes de cualquier endpoint.** El contrato de la API es la fuente de verdad.
- **Deja el repositorio limpio** antes de cerrar sesión (ver §6).
- **Si no sabes algo, busca en `docs/`** antes de inventarlo o asumir.

---

## 5. Cómo elegir una tarea

```
1. Abre feature_list.json
2. Filtra por status == "pending"
3. Coge la de menor "id"
4. Cambia su status a "in_progress" y guarda
5. Anota en progress/current.md: feature, hora de inicio, plan breve
```

---

## 6. Cierre de sesión (lifecycle)

Antes de terminar:

1. Ejecuta `./init.sh` — todo verde.
2. Si la tarea está acabada: marca `status: "done"` en `feature_list.json`.
3. Mueve el resumen de `progress/current.md` al final de `progress/history.md`.
4. Vacía `progress/current.md` dejando solo la plantilla vacía.
5. No dejes archivos temporales, `console.log` de debug, ni TODOs sin contexto.

---

## 7. Si te bloqueas

- Relee la sección relevante de `docs/`.
- Si la herramienta no hace lo que esperas, **no inventes un workaround**:
  documenta el bloqueo en `progress/current.md` y para la sesión.
- No asumas comportamiento de librerías: verifica en la documentación oficial.
