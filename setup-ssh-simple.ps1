# Script simple para configurar SSH key
Write-Host "Configurando SSH key en el droplet..." -ForegroundColor Green

$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"

# Leer la clave pública
$publicKey = Get-Content "$env:USERPROFILE\.ssh\sisrestaurantes_key.pub"

Write-Host "Tu clave publica SSH:" -ForegroundColor Yellow
Write-Host $publicKey -ForegroundColor White
Write-Host ""

Write-Host "Configurando clave en el droplet..." -ForegroundColor Cyan

$setupCommands = "mkdir -p ~/.ssh && echo '$publicKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh && echo 'SSH key configurada correctamente'"

ssh root@$DROPLET_IP $setupCommands

Write-Host ""
Write-Host "SSH key configurada!" -ForegroundColor Green
Write-Host "Probando conexion..." -ForegroundColor Yellow

# Probar conexión
ssh -i "$env:USERPROFILE\.ssh\sisrestaurantes_key" -o ConnectTimeout=10 root@$DROPLET_IP "echo 'Conexion SSH exitosa!'"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Conexion SSH funcionando correctamente!" -ForegroundColor Green
} else {
    Write-Host "Error en la conexion SSH" -ForegroundColor Red
}
