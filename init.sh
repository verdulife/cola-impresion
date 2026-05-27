#!/usr/bin/env bash
# init.sh — Verificación del entorno de cola-impresion
# Ejecutar antes de cada sesión de trabajo. Debe terminar con exit code 0.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  cola-impresion — Verificación de entorno"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Herramientas necesarias ─────────────────────────────────────
echo "[ Herramientas ]"

if command -v bun &>/dev/null; then
  BUN_VERSION=$(bun --version)
  ok "bun $BUN_VERSION"
else
  fail "bun no encontrado — instalar en https://bun.sh"
fi

if command -v docker &>/dev/null; then
  ok "docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
  warn "docker no encontrado — necesario para levantar la API en producción"
fi

if command -v git &>/dev/null; then
  ok "git $(git --version | cut -d' ' -f3)"
else
  fail "git no encontrado"
fi

echo ""

# ── 2. Archivos del arnés ──────────────────────────────────────────
echo "[ Archivos del arnés ]"

REQUIRED_FILES=(
  "AGENTS.md"
  "CHECKPOINTS.md"
  "DESIGN.md"
  "feature_list.json"
  "progress/current.md"
  "progress/history.md"
  "docs/architecture.md"
  "docs/conventions.md"
  "docs/ux.md"
  "docs/api.md"
  "docs/infrastructure.md"
  "docs/verification.md"
  ".opencode/agents/leader.md"
  ".opencode/agents/implementer.md"
  ".opencode/agents/reviewer.md"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    ok "$f"
  else
    fail "$f — FALTA"
  fi
done

echo ""

# ── 3. Estado de feature_list.json ────────────────────────────────
echo "[ Estado de features ]"

if command -v node &>/dev/null || command -v bun &>/dev/null; then
  RUNNER="bun"
  if ! command -v bun &>/dev/null; then RUNNER="node"; fi

  IN_PROGRESS=$($RUNNER -e "
    const fs = require('fs');
    const list = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
    const inProgress = list.filter(f => f.status === 'in_progress');
    console.log(inProgress.length);
  " 2>/dev/null || echo "error")

  if [[ "$IN_PROGRESS" == "error" ]]; then
    fail "No se pudo parsear feature_list.json"
  elif [[ "$IN_PROGRESS" -eq 0 ]]; then
    ok "Sin features en in_progress (sesión limpia)"
  elif [[ "$IN_PROGRESS" -eq 1 ]]; then
    FEATURE_NAME=$($RUNNER -e "
      const fs = require('fs');
      const list = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
      const f = list.find(f => f.status === 'in_progress');
      console.log('[' + f.id + '] ' + f.title);
    " 2>/dev/null)
    warn "Feature en progreso: $FEATURE_NAME"
  else
    fail "Hay $IN_PROGRESS features en in_progress — solo puede haber 1"
  fi

  PENDING=$($RUNNER -e "
    const fs = require('fs');
    const list = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
    console.log(list.filter(f => f.status === 'pending').length);
  " 2>/dev/null || echo "?")
  DONE=$($RUNNER -e "
    const fs = require('fs');
    const list = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
    console.log(list.filter(f => f.status === 'done').length);
  " 2>/dev/null || echo "?")
  TOTAL=$($RUNNER -e "
    const fs = require('fs');
    const list = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
    console.log(list.length);
  " 2>/dev/null || echo "?")

  ok "Progreso: $DONE/$TOTAL completadas ($PENDING pendientes)"
fi

echo ""

# ── 4. Dependencias instaladas ─────────────────────────────────────
echo "[ Dependencias ]"

APPS=("apps/web" "apps/admin" "apps/api")
for app in "${APPS[@]}"; do
  if [[ -d "$app" ]]; then
    if [[ -d "$app/node_modules" ]]; then
      ok "$app — node_modules presente"
    else
      warn "$app — node_modules ausente (ejecutar: cd $app && bun install)"
    fi
  else
    warn "$app — directorio no existe aún (pendiente de implementar)"
  fi
done

echo ""

# ── 5. Tests ───────────────────────────────────────────────────────
echo "[ Tests ]"

TEST_APPS=("apps/web" "apps/admin" "apps/api")
ANY_TESTS=false

for app in "${TEST_APPS[@]}"; do
  if [[ -f "$app/package.json" ]] && grep -q '"test"' "$app/package.json" 2>/dev/null; then
    ANY_TESTS=true
    echo -n "  Ejecutando tests en $app... "
    if cd "$app" && bun test --bail 2>&1 | tail -1 | grep -q "pass\|ok\|passed"; then
      ok "$app — tests en verde"
    else
      fail "$app — tests fallando"
    fi
    cd - > /dev/null
  fi
done

if [[ "$ANY_TESTS" == false ]]; then
  warn "No hay tests aún (se irán añadiendo con cada feature de backend)"
fi

echo ""

# ── 6. Resultado final ─────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}  ✓ Entorno listo para trabajar${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}  ✗ $ERRORS error(s) encontrado(s) — resuelve antes de continuar${NC}"
  echo ""
  exit 1
fi
