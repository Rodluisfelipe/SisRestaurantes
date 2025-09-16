# Script para desplegar cambios del backend al servidor DigitalOcean
# Incluye el sistema de suscripciones

Write-Host "🚀 Iniciando despliegue del backend con sistema de suscripciones..." -ForegroundColor Green

# Configuración del servidor
$SERVER_IP = "157.245.125.216"
$SERVER_USER = "root"
$SSH_KEY = "ssh_key_for_digitalocean.txt"
$REMOTE_PATH = "/root/sisrestaurantes-backend"

# Archivos del backend que necesitan ser actualizados
$BACKEND_FILES = @(
    "Backend/Models/Subscription.js",
    "Backend/Routes/subscriptions.js", 
    "Backend/server.js",
    "Backend/package.json"
)

Write-Host "📁 Archivos a actualizar:" -ForegroundColor Yellow
foreach ($file in $BACKEND_FILES) {
    Write-Host "  - $file" -ForegroundColor Cyan
}

# Verificar que los archivos existen
Write-Host "`n🔍 Verificando archivos..." -ForegroundColor Yellow
foreach ($file in $BACKEND_FILES) {
    if (Test-Path $file) {
        Write-Host "✅ $file existe" -ForegroundColor Green
    } else {
        Write-Host "❌ $file NO existe" -ForegroundColor Red
        exit 1
    }
}

# Conectar al servidor y actualizar archivos
Write-Host "`n🔌 Conectando al servidor..." -ForegroundColor Yellow

# Crear directorio temporal en el servidor
$tempDir = "/tmp/sisrestaurantes-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "📂 Creando directorio temporal: $tempDir" -ForegroundColor Cyan

# Subir archivos uno por uno
foreach ($file in $BACKEND_FILES) {
    $fileName = Split-Path $file -Leaf
    $remoteFile = "$tempDir/$fileName"
    
    Write-Host "📤 Subiendo $file..." -ForegroundColor Cyan
    
    # Usar scp para subir el archivo
    $scpCommand = "scp -i $SSH_KEY $file $SERVER_USER@$SERVER_IP`:$remoteFile"
    Write-Host "Ejecutando: $scpCommand" -ForegroundColor Gray
    
    try {
        Invoke-Expression $scpCommand
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $fileName subido correctamente" -ForegroundColor Green
        } else {
            Write-Host "❌ Error subiendo $fileName" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Error en scp: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n🔄 Actualizando archivos en el servidor..." -ForegroundColor Yellow

# Comando SSH para actualizar los archivos
$sshCommands = @"
# Crear directorio temporal
mkdir -p $tempDir

# Mover archivos actualizados
echo "📁 Moviendo archivos actualizados..."

# Actualizar Subscription.js
if [ -f "$tempDir/Subscription.js" ]; then
    cp "$tempDir/Subscription.js" "$REMOTE_PATH/Models/Subscription.js"
    echo "✅ Subscription.js actualizado"
else
    echo "❌ Subscription.js no encontrado"
fi

# Actualizar subscriptions.js (rutas)
if [ -f "$tempDir/subscriptions.js" ]; then
    cp "$tempDir/subscriptions.js" "$REMOTE_PATH/Routes/subscriptions.js"
    echo "✅ subscriptions.js actualizado"
else
    echo "❌ subscriptions.js no encontrado"
fi

# Actualizar server.js
if [ -f "$tempDir/server.js" ]; then
    cp "$tempDir/server.js" "$REMOTE_PATH/server.js"
    echo "✅ server.js actualizado"
else
    echo "❌ server.js no encontrado"
fi

# Actualizar package.json
if [ -f "$tempDir/package.json" ]; then
    cp "$tempDir/package.json" "$REMOTE_PATH/package.json"
    echo "✅ package.json actualizado"
else
    echo "❌ package.json no encontrado"
fi

# Limpiar directorio temporal
rm -rf $tempDir
echo "🧹 Directorio temporal limpiado"

# Verificar que los archivos fueron actualizados
echo "🔍 Verificando archivos actualizados..."
ls -la "$REMOTE_PATH/Models/Subscription.js"
ls -la "$REMOTE_PATH/Routes/subscriptions.js"
ls -la "$REMOTE_PATH/server.js"

echo "✅ Archivos actualizados correctamente"
"@

# Ejecutar comandos SSH
Write-Host "🔧 Ejecutando comandos en el servidor..." -ForegroundColor Yellow
$sshCommand = "ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP `"$sshCommands`""

try {
    Invoke-Expression $sshCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Archivos actualizados en el servidor" -ForegroundColor Green
    } else {
        Write-Host "❌ Error actualizando archivos en el servidor" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error en SSH: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔄 Reiniciando servicios..." -ForegroundColor Yellow

# Comando para reiniciar los servicios
$restartCommands = @"
# Detener contenedores existentes
echo "🛑 Deteniendo contenedores..."
docker-compose -f $REMOTE_PATH/docker-compose.yml down

# Reconstruir y reiniciar
echo "🔨 Reconstruyendo y reiniciando servicios..."
cd $REMOTE_PATH
docker-compose up -d --build

# Verificar estado
echo "🔍 Verificando estado de los servicios..."
docker-compose ps

# Verificar logs del backend
echo "📋 Últimas líneas del log del backend:"
docker-compose logs --tail=20 backend

echo "✅ Servicios reiniciados correctamente"
"@

$restartCommand = "ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP `"$restartCommands`""

try {
    Invoke-Expression $restartCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Servicios reiniciados correctamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Error reiniciando servicios" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error reiniciando servicios: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 ¡Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host "📊 Sistema de suscripciones desplegado en: http://$SERVER_IP" -ForegroundColor Cyan
Write-Host "🔗 API de suscripciones: http://$SERVER_IP/api/subscriptions" -ForegroundColor Cyan
Write-Host "`n📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Verificar que el backend esté funcionando" -ForegroundColor White
Write-Host "2. Probar las rutas de suscripciones" -ForegroundColor White
Write-Host "3. Desplegar el frontend actualizado" -ForegroundColor White
