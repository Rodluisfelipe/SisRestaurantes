# Script de PowerShell para configurar SSL en el servidor
# Ejecuta el script de configuración SSL en el servidor Digital Ocean

param(
    [string]$Domain = "api.menuby.tech"  # Dominio por defecto
)

$SSH_KEY = "C:\Users\TECNOPHONE\.ssh\sisrestaurantes_key"
$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"

Write-Host "🔒 Configurando SSL para el dominio: $Domain" -ForegroundColor Green

# Verificar que el dominio apunte a la IP correcta
Write-Host "🔍 Verificando DNS..." -ForegroundColor Yellow
try {
    $dnsResult = Resolve-DnsName -Name $Domain -ErrorAction Stop
    $dnsIP = $dnsResult | Where-Object { $_.Type -eq "A" } | Select-Object -First 1 -ExpandProperty IPAddress
    
    if ($dnsIP -eq $DROPLET_IP) {
        Write-Host "✅ DNS configurado correctamente: $Domain -> $dnsIP" -ForegroundColor Green
    } else {
        Write-Host "⚠️ ADVERTENCIA: $Domain apunta a $dnsIP, pero esperábamos $DROPLET_IP" -ForegroundColor Yellow
        Write-Host "💡 Continúo con la configuración, pero puede fallar si el DNS no está correcto" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ No se pudo resolver el DNS para $Domain" -ForegroundColor Red
    Write-Host "💡 Asegúrate de que el dominio apunte a $DROPLET_IP antes de continuar" -ForegroundColor Yellow
    $continue = Read-Host "¿Continuar de todos modos? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Subir el script de configuración al servidor
Write-Host "📤 Subiendo script de configuración SSL..." -ForegroundColor Yellow
scp -i $SSH_KEY configure-ssl.sh "${DROPLET_USER}@${DROPLET_IP}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Script subido correctamente" -ForegroundColor Green
    
    # Ejecutar el script en el servidor
    Write-Host "🚀 Ejecutando configuración SSL..." -ForegroundColor Yellow
    ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "chmod +x /tmp/configure-ssl.sh && /tmp/configure-ssl.sh $Domain"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SSL configurado correctamente" -ForegroundColor Green
        Write-Host "🔒 Backend disponible en: https://$Domain" -ForegroundColor Cyan
        Write-Host "🌐 API Health: https://$Domain/api/health" -ForegroundColor Cyan
        
        # Limpiar archivo temporal
        ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "rm /tmp/configure-ssl.sh"
        
        # Probar la conexión HTTPS
        Write-Host "🧪 Probando conexión HTTPS..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "https://$Domain/api/health" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Conexión HTTPS funcionando correctamente" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Respuesta inesperada: $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Error al probar HTTPS: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Error al configurar SSL" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Error al subir el script" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Configuración SSL completada!" -ForegroundColor Green
