param([switch]$Uninstall)

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$TASKS = @(
    @{Name="RadarFX-Bridge"; Command="python"; Args="`"$ROOT\bridge\mt5_bridge.py`""; Description="MT5 Python Bridge (porta 5555)"},
    @{Name="RadarFX-Server"; Command="cmd.exe"; Args="/c cd /d `"$ROOT\server`" && npm run dev"; Description="Node.js API Server (porta 3015)"},
    @{Name="RadarFX-Client"; Command="cmd.exe"; Args="/c cd /d `"$ROOT\client`" && npm run dev"; Description="Vite Frontend (porta 3006)"},
    @{Name="RadarFX-Watchdog"; Command="cmd.exe"; Args="/c `"$ROOT\watchdog.bat`""; Description="Monitor de processos (30s loop)"}
)

if ($Uninstall) {
    Write-Host "Removendo tarefas agendadas do Radar FX..." -ForegroundColor Yellow
    foreach ($t in $TASKS) {
        schtasks /Delete /TN $t.Name /F 2>$null
        Write-Host "  ✗ $($t.Name) removida" -ForegroundColor Red
    }
    Write-Host "`nTodas as tarefas foram removidas." -ForegroundColor Green
    return
}

Write-Host "=== INSTALADOR RADAR FX - INICIO AUTOMATICO ===" -ForegroundColor Cyan
Write-Host "Criando tarefas agendadas para iniciar com o Windows...`n" -ForegroundColor Cyan

# Verificar se tem permissão de admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "AVISO: Execute como Administrador para criar tarefas agendadas!" -ForegroundColor Red
    Write-Host "Tentando elevar privilégios..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    return
}

foreach ($t in $TASKS) {
    Write-Host "  Criando $($t.Name)..." -ForegroundColor Yellow
    
    # Remove se existir
    schtasks /Delete /TN $t.Name /F 2>$null
    
    # Cria task 
    if ($t.Name -eq "RadarFX-Bridge") {
        schtasks /Create /SC ONLOGON /DELAY 0000:30 /TN $t.Name /TR "$($t.Command) $($t.Args)" /RL HIGHEST /F /IT
    } else {
        schtasks /Create /SC ONLOGON /DELAY 0000:45 /TN $t.Name /TR "$($t.Command) $($t.Args)" /RL HIGHEST /F /IT
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $($t.Name) criada!" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Falha ao criar $($t.Name)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Tarefas agendadas criadas!" -ForegroundColor Green
Write-Host "  - Bridge MT5 (30s after logon)" -ForegroundColor Cyan
Write-Host "  - Server API (45s after logon)" -ForegroundColor Cyan
Write-Host "  - Frontend (45s after logon)" -ForegroundColor Cyan
Write-Host "  - Watchdog (45s after logon)" -ForegroundColor Cyan
Write-Host "`nExecutar agora? (S/N)" -ForegroundColor Yellow
$key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
if ($key.Character -eq 's' -or $key.Character -eq 'S') {
    Write-Host "`nIniciando servicos..." -ForegroundColor Green
    Start-Process cmd -ArgumentList "/c cd /d `"$ROOT`" && start_all.bat" -WindowStyle Hidden
}
