# Deja esta caja como recién instalada: sin base local y sin vincular.
#
# Para pruebas y para reinstalar un equipo. NO borra nada: la base se mueve a
# %APPDATA%\tech.menuby.pos-respaldos\<fecha>, porque puede tener ventas que
# todavía no subieron a la nube, y esas no existen en ningún otro lado.
#
# Uso: doble clic en reiniciar-caja.cmd (o este .ps1 con -ExecutionPolicy Bypass).

$ErrorActionPreference = 'Stop'
$datos     = Join-Path $env:APPDATA 'tech.menuby.pos'
$respaldos = Join-Path $env:APPDATA 'tech.menuby.pos-respaldos'
$token     = 'token-negocio.tech.menuby.pos'

Write-Host ''
Write-Host 'Reiniciar la caja MenuBy POS desde cero' -ForegroundColor Cyan
Write-Host '  - Cierra la caja si esta abierta'
Write-Host "  - Mueve la base local a $respaldos"
Write-Host '  - Quita la vinculacion con el negocio (token del llavero de Windows)'
Write-Host ''
Write-Host 'Las ventas que no hayan subido quedan SOLO en el respaldo.' -ForegroundColor Yellow
$ok = Read-Host 'Escribe SI para continuar'
if ($ok -ne 'SI') { Write-Host 'Cancelado. No se toco nada.'; exit 1 }

# 1. La caja abierta tiene la base tomada: hay que cerrarla antes de moverla.
$abierta = Get-Process -Name 'pos-nativo' -ErrorAction SilentlyContinue
if ($abierta) {
    Write-Host 'Cerrando la caja...'
    $abierta | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 2. La base, al respaldo.
if (Test-Path $datos) {
    $destino = Join-Path $respaldos (Get-Date -Format 'yyyyMMdd-HHmmss')
    New-Item -ItemType Directory -Force -Path $destino | Out-Null
    Get-ChildItem -Force $datos | Move-Item -Destination $destino
    Write-Host "Base movida a: $destino" -ForegroundColor Green
} else {
    Write-Host 'No habia base local.'
}

# 3. El token del negocio, fuera del llavero. Sin esto la caja nueva seguiria
#    hablando con el negocio anterior.
cmdkey /delete:$token 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host 'Vinculacion quitada del llavero.' -ForegroundColor Green
} else {
    Write-Host 'No habia vinculacion en el llavero.'
}

Write-Host ''
Write-Host 'Listo. Abre MenuBy POS: arranca pidiendo el codigo de vinculacion.' -ForegroundColor Cyan
Write-Host 'Para deshacerlo: cierra la caja y copia el respaldo de vuelta a' $datos
