# Script para reiniciar el backend
$SSH_KEY = "C:\Users\TECNOPHONE\.ssh\sisrestaurantes_key"
$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"

Write-Host "Reiniciando backend..." -ForegroundColor Green

# Detener contenedor existente
Write-Host "Deteniendo contenedor existente..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "docker stop sisrestaurantes-backend 2>/dev/null || true"
ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "docker rm sisrestaurantes-backend 2>/dev/null || true"

# Subir archivo de configuración actualizado
Write-Host "Subiendo configuración actualizada..." -ForegroundColor Yellow
scp -i $SSH_KEY Backend\.env.production "${DROPLET_USER}@${DROPLET_IP}:/opt/sisrestaurantes/"

# Iniciar nuevo contenedor
Write-Host "Iniciando nuevo contenedor..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "cd /opt/sisrestaurantes && docker run -d --name sisrestaurantes-backend -p 80:5000 --env-file .env.production sisrestaurantes-backend"

# Verificar que esté corriendo
Write-Host "Verificando estado..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${DROPLET_USER}@${DROPLET_IP}" "docker ps | grep sisrestaurantes-backend"

Write-Host "Backend reiniciado!" -ForegroundColor Green
