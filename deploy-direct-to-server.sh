#!/bin/bash

# Script de despliegue directo al servidor (sin Docker local)
echo "🚀 Desplegando directamente al servidor Digital Ocean..."

# Variables configuradas
DROPLET_IP="157.245.125.216"
DROPLET_USER="root"
FRONTEND_URL="https://www.menuby.tech"

echo "📋 Verificando configuración..."

# Verificar que existe el archivo .env.production.personalizado
if [ ! -f "Backend/.env.production.personalizado" ]; then
    echo "❌ Error: No se encontró Backend/.env.production.personalizado"
    exit 1
fi

echo "🔧 Configuración:"
echo "   Backend IP: $DROPLET_IP"
echo "   Frontend URL: $FRONTEND_URL"
echo "   MongoDB: Configurado"
echo "   Email: pipe95141007@gmail.com"

echo ""
echo "📦 Subiendo código al servidor..."

# Crear archivo .env.production
cp Backend/.env.production.personalizado Backend/.env.production

# Subir código al servidor
echo "📤 Subiendo archivos al servidor..."
scp -r Backend/* $DROPLET_USER@$DROPLET_IP:/opt/sisrestaurantes/

echo "🔄 Conectando al servidor para construir y ejecutar..."
ssh $DROPLET_USER@$DROPLET_IP << 'EOF'
    cd /opt/sisrestaurantes
    
    echo "🛑 Deteniendo contenedor anterior..."
    docker stop sisrestaurantes-backend || true
    docker rm sisrestaurantes-backend || true
    
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
EOF

echo ""
echo "✅ Despliegue directo completado!"
echo ""
echo "🌐 URLs de tu aplicación:"
echo "   Backend: http://$DROPLET_IP"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "🔧 Comandos de verificación:"
echo "   Verificar contenedor: ssh $DROPLET_USER@$DROPLET_IP 'docker ps | grep sisrestaurantes-backend'"
echo "   Ver logs: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Probar API: curl http://$DROPLET_IP/api/health"
