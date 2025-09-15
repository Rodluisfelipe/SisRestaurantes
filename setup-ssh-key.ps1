# Script para configurar SSH key en el droplet
Write-Host "🔑 Configurando SSH key en el droplet..." -ForegroundColor Green

$DROPLET_IP = "157.245.125.216"
$DROPLET_USER = "root"

# Leer la clave pública
$publicKey = Get-Content "$env:USERPROFILE\.ssh\sisrestaurantes_key.pub"

Write-Host "📋 Tu clave pública SSH:" -ForegroundColor Yellow
Write-Host $publicKey -ForegroundColor White
Write-Host ""

Write-Host "📝 Instrucciones para agregar la clave al droplet:" -ForegroundColor Cyan
Write-Host "1. Conéctate al droplet:" -ForegroundColor White
Write-Host "   ssh root@$DROPLET_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Ejecuta estos comandos en el droplet:" -ForegroundColor White
Write-Host "   mkdir -p ~/.ssh" -ForegroundColor Gray
Write-Host "   echo '$publicKey' >> ~/.ssh/authorized_keys" -ForegroundColor Gray
Write-Host "   chmod 600 ~/.ssh/authorized_keys" -ForegroundColor Gray
Write-Host "   chmod 700 ~/.ssh" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Prueba la conexión:" -ForegroundColor White
Write-Host "   ssh -i $env:USERPROFILE\.ssh\sisrestaurantes_key root@$DROPLET_IP" -ForegroundColor Gray
Write-Host ""

Write-Host "¿Quieres que intente configurar la clave automáticamente? (y/n): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "🔧 Configurando clave automáticamente..." -ForegroundColor Green
    
    $setupCommands = @"
mkdir -p ~/.ssh
echo '$publicKey' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
echo "SSH key configurada correctamente"
"@
    
    ssh root@$DROPLET_IP $setupCommands
    
    Write-Host ""
    Write-Host "✅ SSH key configurada!" -ForegroundColor Green
    Write-Host "🔧 Probando conexión..." -ForegroundColor Yellow
    
    # Probar conexión
    ssh -i "$env:USERPROFILE\.ssh\sisrestaurantes_key" -o ConnectTimeout=10 root@$DROPLET_IP "echo 'Conexion SSH exitosa!'"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexión SSH funcionando correctamente!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en la conexión SSH" -ForegroundColor Red
    }
} else {
    Write-Host "📋 Configura la clave manualmente siguiendo las instrucciones arriba" -ForegroundColor Yellow
}
