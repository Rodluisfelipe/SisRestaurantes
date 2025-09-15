# Script de despliegue para Windows PowerShell
Write-Host "🚀 Desplegando Backend a Digital Ocean..." -ForegroundColor Green

# Variables configuradas
$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"
$FRONTEND_URL = "https://www.menuby.tech"

Write-Host "📋 Verificando configuración..." -ForegroundColor Yellow

# Verificar que existe el archivo .env.production.personalizado
if (-not (Test-Path "Backend\.env.production.personalizado")) {
    Write-Host "❌ Error: No se encontró Backend\.env.production.personalizado" -ForegroundColor Red
    exit 1
}

# Copiar archivo personalizado como .env.production
Copy-Item "Backend\.env.production.personalizado" "Backend\.env.production"

Write-Host "🔧 Configuración:" -ForegroundColor Cyan
Write-Host "   Backend IP: $DROPLET_IP" -ForegroundColor White
Write-Host "   Frontend URL: $FRONTEND_URL" -ForegroundColor White
Write-Host "   MongoDB: Configurado" -ForegroundColor White
Write-Host "   Email: pipe95141007@gmail.com" -ForegroundColor White

Write-Host ""
Write-Host "📦 Subiendo código al servidor..." -ForegroundColor Yellow

# Crear directorio en el servidor si no existe
Write-Host "📤 Creando directorio en el servidor..." -ForegroundColor Yellow
ssh $DROPLET_USER@$DROPLET_IP "mkdir -p /opt/sisrestaurantes"

# Subir archivos al servidor
Write-Host "📤 Subiendo archivos al servidor..." -ForegroundColor Yellow
scp -r Backend\* "${DROPLET_USER}@${DROPLET_IP}:/opt/sisrestaurantes/"

Write-Host "🔄 Conectando al servidor para construir y ejecutar..." -ForegroundColor Yellow

# Ejecutar comandos en el servidor
$commands = @"
cd /opt/sisrestaurantes

echo "🛑 Deteniendo contenedor anterior..."
docker stop sisrestaurantes-backend 2>/dev/null || true
docker rm sisrestaurantes-backend 2>/dev/null || true

echo "📦 Construyendo imagen Docker en el servidor..."
docker build -t sisrestaurantes/backend:latest .

echo "🚀 Ejecutando nuevo contenedor..."
docker run -d \
    --name sisrestaurantes-backend \
    --restart unless-stopped \
    -p 80:5000 \
    -p 443:5000 \
    --env-file .env.production \
    sisrestaurantes/backend:latest

echo "✅ Verificando que esté corriendo..."
sleep 5
docker ps | grep sisrestaurantes-backend

echo "🔍 Verificando logs..."
docker logs sisrestaurantes-backend --tail 20
"@

ssh $DROPLET_USER@$DROPLET_IP $commands

Write-Host ""
Write-Host "Despliegue completado!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 URLs de tu aplicación:" -ForegroundColor Cyan
Write-Host "   Backend: http://$DROPLET_IP" -ForegroundColor White
Write-Host "   Frontend: $FRONTEND_URL" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos de verificación:" -ForegroundColor Yellow
Write-Host "   Verificar contenedor: ssh $DROPLET_USER@$DROPLET_IP 'docker ps | grep sisrestaurantes-backend'" -ForegroundColor White
Write-Host "   Ver logs: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'" -ForegroundColor White
Write-Host "   Probar API: curl http://$DROPLET_IP/api/health" -ForegroundColor White
