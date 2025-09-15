# Script de PowerShell para configurar SSL con IP
# Ejecuta el script de configuración SSL en el servidor Digital Ocean

$SSH_KEY = "C:\Users\TECNOPHONE\.ssh\sisrestaurantes_key"
$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"
$DOMAIN = "$DROPLET_IP.nip.io"

Write-Host "🔒 Configurando SSL para IP: $DROPLET_IP usando $DOMAIN" -ForegroundColor Green

# Subir el script de configuración al servidor
Write-Host "📤 Subiendo script de configuración SSL..." -ForegroundColor Yellow
scp -i $SSH_KEY configure-ssl-ip.sh "${DROPLET_USER}@${DROPLET_IP}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Script subido correctamente" -ForegroundColor Green
    
    # Ejecutar el script en el servidor
    Write-Host "🚀 Ejecutando configuración SSL..." -ForegroundColor Yellow
    ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "chmod +x /tmp/configure-ssl-ip.sh && /tmp/configure-ssl-ip.sh"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SSL configurado correctamente" -ForegroundColor Green
        Write-Host "🔒 Backend disponible en: https://$DOMAIN" -ForegroundColor Cyan
        Write-Host "🌐 API Health: https://$DOMAIN/api/health" -ForegroundColor Cyan
        Write-Host "📱 Socket.IO: https://$DOMAIN/socket.io/" -ForegroundColor Cyan
        
        # Limpiar archivo temporal
        ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "rm /tmp/configure-ssl-ip.sh"
        
        # Probar la conexión HTTPS
        Write-Host "Probando conexión HTTPS..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "https://$DOMAIN/api/health" -UseBasicParsing -TimeoutSec 10 -SkipCertificateCheck
            if ($response.StatusCode -eq 200) {
                Write-Host "Conexión HTTPS funcionando correctamente" -ForegroundColor Green
            } else {
                Write-Host "Respuesta inesperada: $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Error al probar HTTPS: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Esto es normal si se usó certificado autofirmado" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "❌ Error al configurar SSL" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Error al subir el script" -ForegroundColor Red
    exit 1
}

Write-Host "Configuración SSL completada!" -ForegroundColor Green
Write-Host "Actualiza las URLs del frontend para usar: https://$DOMAIN" -ForegroundColor Yellow
