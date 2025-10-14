#!/bin/bash

# Script de despliegue SOLO BACKEND al servidor Digital Ocean
echo "🚀 Desplegando SOLO BACKEND al servidor Digital Ocean..."

# Variables configuradas
DROPLET_IP="157.245.125.216"
DROPLET_USER="root"

echo "📋 Verificando configuración..."

# Verificar que existe el archivo .env.production.personalizado
if [ ! -f "Backend/.env.production.personalizado" ]; then
    echo "❌ Error: No se encontró Backend/.env.production.personalizado"
    exit 1
fi

echo "🔧 Configuración:"
echo "   Backend IP: $DROPLET_IP"
echo "   Usuario: $DROPLET_USER"
echo "   Solo Backend: ✅"

echo ""
echo "📦 Preparando archivos del backend..."

# Crear archivo .env.production
cp Backend/.env.production.personalizado Backend/.env.production

echo "📤 Subiendo archivos del backend al servidor..."
scp -r Backend/* $DROPLET_USER@$DROPLET_IP:/opt/sisrestaurantes/

echo "🔄 Conectando al servidor para reconstruir y ejecutar..."
ssh $DROPLET_USER@$DROPLET_IP << 'EOF'
    cd /opt/sisrestaurantes
    
    echo "🛑 Deteniendo contenedor anterior..."
    docker stop sisrestaurantes-backend || true
    docker rm sisrestaurantes-backend || true
    
    echo "📦 Construyendo nueva imagen Docker..."
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
    
    echo "🔍 Verificando logs recientes..."
    docker logs sisrestaurantes-backend --tail 10
    
    echo "🌐 Probando endpoint de salud..."
    curl -s http://localhost/api/health || echo "⚠️  Endpoint no disponible aún"
EOF

echo ""
echo "✅ Despliegue del BACKEND completado!"
echo ""
echo "🌐 URLs de tu aplicación:"
echo "   Backend API: http://$DROPLET_IP"
echo "   Health Check: http://$DROPLET_IP/api/health"
echo ""
echo "🔧 Comandos de verificación:"
echo "   Verificar contenedor: ssh $DROPLET_USER@$DROPLET_IP 'docker ps | grep sisrestaurantes-backend'"
echo "   Ver logs: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Probar API: curl http://$DROPLET_IP/api/health"