# Script de despliegue rápido para aplicar la corrección del error 500
Write-Host "=== DESPLIEGUE RÁPIDO - CORRECCIÓN ERROR 500 ===" -ForegroundColor Green

# Detener procesos Node.js existentes
Write-Host "Deteniendo procesos Node.js existentes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# Esperar un momento
Start-Sleep -Seconds 2

# Navegar al directorio Backend
Set-Location "Backend"

# Instalar dependencias si es necesario
Write-Host "Verificando dependencias..." -ForegroundColor Yellow
npm install

# Iniciar el servidor
Write-Host "Iniciando servidor backend..." -ForegroundColor Green
npm start

Write-Host "=== DESPLIEGUE COMPLETADO ===" -ForegroundColor Green
Write-Host "El servidor debería estar ejecutándose ahora." -ForegroundColor Cyan
Write-Host "Prueba el endpoint: https://157-245-125-216.nip.io/api/topping-groups/test" -ForegroundColor Cyan
