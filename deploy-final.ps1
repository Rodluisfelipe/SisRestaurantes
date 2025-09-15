# Script de despliegue final usando la nueva SSH key
Write-Host "Desplegando Backend a Digital Ocean..." -ForegroundColor Green

$DROPLET_IP = "157.245.125.216"
$SSH_KEY = "$env:USERPROFILE\.ssh\sisrestaurantes_key"

Write-Host "Configuracion:" -ForegroundColor Cyan
Write-Host "   Backend IP: $DROPLET_IP" -ForegroundColor White
Write-Host "   Frontend URL: https://www.menuby.tech" -ForegroundColor White
Write-Host "   MongoDB: Configurado" -ForegroundColor White
Write-Host "   Email: pipe95141007@gmail.com" -ForegroundColor White

Write-Host ""
Write-Host "Subiendo archivos al servidor..." -ForegroundColor Yellow

# Crear directorio en el servidor
ssh -i $SSH_KEY root@$DROPLET_IP "mkdir -p /opt/sisrestaurantes"

# Subir archivos
scp -i $SSH_KEY -r Backend\* "root@${DROPLET_IP}:/opt/sisrestaurantes/"

Write-Host "Conectando al servidor para construir y ejecutar..." -ForegroundColor Yellow

# Ejecutar comandos en el servidor
$commands = @"
cd /opt/sisrestaurantes

echo "Deteniendo contenedor anterior..."
docker stop sisrestaurantes-backend 2>/dev/null || true
docker rm sisrestaurantes-backend 2>/dev/null || true

echo "Construyendo imagen Docker..."
docker build -t sisrestaurantes/backend:latest .

echo "Ejecutando nuevo contenedor..."
docker run -d \
    --name sisrestaurantes-backend \
    --restart unless-stopped \
    -p 80:5000 \
    -p 443:5000 \
    --env-file .env.production \
    sisrestaurantes/backend:latest

echo "Verificando que este corriendo..."
sleep 5
docker ps | grep sisrestaurantes-backend

echo "Verificando logs..."
docker logs sisrestaurantes-backend --tail 20
"@

ssh -i $SSH_KEY root@$DROPLET_IP $commands

Write-Host ""
Write-Host "Despliegue completado!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs de tu aplicacion:" -ForegroundColor Cyan
Write-Host "   Backend: http://$DROPLET_IP" -ForegroundColor White
Write-Host "   Frontend: https://www.menuby.tech" -ForegroundColor White
Write-Host ""
Write-Host "Comandos de verificacion:" -ForegroundColor Yellow
Write-Host "   Verificar contenedor: ssh -i $SSH_KEY root@$DROPLET_IP 'docker ps | grep sisrestaurantes-backend'" -ForegroundColor Gray
Write-Host "   Ver logs: ssh -i $SSH_KEY root@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'" -ForegroundColor Gray
Write-Host "   Probar API: curl http://$DROPLET_IP/api/health" -ForegroundColor Gray
