# init.ps1 - Verificacion del entorno de cola-impresion (Windows PowerShell)
# Ejecutar antes de cada sesion de trabajo. Debe terminar con exit code 0.

$ErrorActionPreference = 'Continue'

$script:ERRORS = 0

function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:ERRORS++ }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "========================================"
Write-Host "  cola-impresion - Verificacion de entorno"
Write-Host "========================================"
Write-Host ""

# 1. Herramientas necesarias
Write-Host "[ Herramientas ]"

if (Get-Command bun -ErrorAction SilentlyContinue) {
    $bunVersion = & bun --version
    Write-Ok "bun $bunVersion"
} else {
    Write-Fail "bun no encontrado - instalar en https://bun.sh"
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerVersion = (& docker --version) -replace '.*version\s+', '' -replace ',.*', ''
    Write-Ok "docker $dockerVersion"
} else {
    Write-Warn "docker no encontrado - necesario para levantar la API en produccion"
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitVersion = (& git --version) -replace '.*version\s+', ''
    Write-Ok "git $gitVersion"
} else {
    Write-Fail "git no encontrado"
}

Write-Host ""

# 2. Archivos del arnes
Write-Host "[ Archivos del arnes ]"

$requiredFiles = @(
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

foreach ($f in $requiredFiles) {
    if (Test-Path $f) {
        Write-Ok $f
    } else {
        Write-Fail "$f - FALTA"
    }
}

Write-Host ""

# 3. Estado de feature_list.json
Write-Host "[ Estado de features ]"

if (Test-Path "feature_list.json") {
    try {
        $list = Get-Content "feature_list.json" -Raw | ConvertFrom-Json

        $inProgress = @($list | Where-Object { $_.status -eq 'in_progress' })
        $pending = @($list | Where-Object { $_.status -eq 'pending' })
        $done = @($list | Where-Object { $_.status -eq 'done' })
        $total = $list.Count

        if ($inProgress.Count -eq 0) {
            Write-Ok "Sin features en in_progress (sesion limpia)"
        } elseif ($inProgress.Count -eq 1) {
            $feature = $inProgress[0]
            Write-Warn "Feature en progreso: [$($feature.id)] $($feature.title)"
        } else {
            Write-Fail "Hay $($inProgress.Count) features en in_progress - solo puede haber 1"
        }

        Write-Ok "Progreso: $($done.Count)/$total completadas ($($pending.Count) pendientes)"
    } catch {
        Write-Fail "No se pudo parsear feature_list.json: $_"
    }
} else {
    Write-Fail "feature_list.json no encontrado"
}

Write-Host ""

# 4. Dependencias instaladas
Write-Host "[ Dependencias ]"

$apps = @("apps/web", "apps/admin", "apps/api")
foreach ($app in $apps) {
    if (Test-Path $app) {
        if (Test-Path "$app/node_modules") {
            Write-Ok "$app - node_modules presente"
        } else {
            Write-Warn "$app - node_modules ausente (ejecutar: cd $app; bun install)"
        }
    } else {
        Write-Warn "$app - directorio no existe aun (pendiente de implementar)"
    }
}

Write-Host ""

# 5. Tests
Write-Host "[ Tests ]"

$anyTests = $false

foreach ($app in $apps) {
    $pkgJson = "$app/package.json"
    if (Test-Path $pkgJson) {
        $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
        if ($pkg.scripts -and $pkg.scripts.test) {
            $anyTests = $true
            Write-Host "  Ejecutando tests en $app... " -NoNewline
            Push-Location $app
            try {
                $testOutput = & bun test --bail 2>&1 | Out-String
                if ($testOutput -match 'pass|ok|passed') {
                    Write-Ok "$app - tests en verde"
                } else {
                    Write-Fail "$app - tests fallando"
                }
            } catch {
                Write-Fail "$app - error ejecutando tests: $_"
            } finally {
                Pop-Location
            }
        }
    }
}

if (-not $anyTests) {
    Write-Warn "No hay tests aun (se iran añadiendo con cada feature de backend)"
}

Write-Host ""

# 6. Resultado final
Write-Host "========================================"
if ($script:ERRORS -eq 0) {
    Write-Host "  [OK] Entorno listo para trabajar" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "  [FAIL] $($script:ERRORS) error(s) encontrado(s) - resuelve antes de continuar" -ForegroundColor Red
    Write-Host ""
    exit 1
}
