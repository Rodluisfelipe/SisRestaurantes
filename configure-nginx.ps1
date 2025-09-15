# Script de PowerShell para configurar Nginx en el servidor
# Ejecuta el script de configuración de Nginx en el servidor Digital Ocean

$SSH_KEY = "C:\Users\TECNOPHONE\.ssh\sisrestaurantes_key"
$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"

Write-Host "🔧 Configurando Nginx en el servidor..." -ForegroundColor Green

# Subir el script de configuración al servidor
Write-Host "📤 Subiendo script de configuración..." -ForegroundColor Yellow
scp -i $SSH_KEY configure-nginx.sh "${DROPLET_USER}@${DROPLET_IP}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Script subido correctamente" -ForegroundColor Green
    
    # Ejecutar el script en el servidor
    Write-Host "🚀 Ejecutando configuración de Nginx..." -ForegroundColor Yellow
    ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "chmod +x /tmp/configure-nginx.sh && /tmp/configure-nginx.sh"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Nginx configurado correctamente" -ForegroundColor Green
        Write-Host "🌐 Backend disponible en: http://$DROPLET_IP" -ForegroundColor Cyan
        
        # Limpiar archivo temporal
        ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "rm /tmp/configure-nginx.sh"
        
    } else {
        Write-Host "❌ Error al configurar Nginx" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Error al subir el script" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Configuración de Nginx completada!" -ForegroundColor Green
