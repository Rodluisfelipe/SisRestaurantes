# Script simple de despliegue
Write-Host "Desplegando Backend a Digital Ocean..." -ForegroundColor Green

$DROPLET_IP = "157.245.125.216"
$SSH_KEY = "$env:USERPROFILE\.ssh\sisrestaurantes_key"

Write-Host "Subiendo archivos..." -ForegroundColor Yellow
scp -i $SSH_KEY -r Backend\* "root@${DROPLET_IP}:/opt/sisrestaurantes/"

Write-Host "Conectando al servidor..." -ForegroundColor Yellow

# Ejecutar comandos uno por uno para evitar problemas de codificación
ssh -i $SSH_KEY root@$DROPLET_IP "cd /opt/sisrestaurantes"

ssh -i $SSH_KEY root@$DROPLET_IP "docker stop sisrestaurantes-backend || true"

ssh -i $SSH_KEY root@$DROPLET_IP "docker rm sisrestaurantes-backend || true"

ssh -i $SSH_KEY root@$DROPLET_IP "cd /opt/sisrestaurantes && docker build -t sisrestaurantes/backend:latest ."

ssh -i $SSH_KEY root@$DROPLET_IP "docker run -d --name sisrestaurantes-backend --restart unless-stopped -p 80:5000 --env-file /opt/sisrestaurantes/.env.production sisrestaurantes/backend:latest"

Write-Host "Verificando despliegue..." -ForegroundColor Yellow
ssh -i $SSH_KEY root@$DROPLET_IP "docker ps | grep sisrestaurantes-backend"

Write-Host "Despliegue completado!" -ForegroundColor Green
Write-Host "Backend: http://$DROPLET_IP" -ForegroundColor Cyan
