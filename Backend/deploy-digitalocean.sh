#!/bin/bash

# Script de despliegue para Digital Ocean
echo "🚀 Desplegando backend a Digital Ocean..."

# Variables (actualizar según tu configuración)
DROPLET_IP="your-droplet-ip"
DROPLET_USER="root"
APP_NAME="sisrestaurantes-backend"
DOCKER_IMAGE="sisrestaurantes/backend:latest"

echo "📦 Construyendo imagen Docker..."
docker build -t $DOCKER_IMAGE .

echo "📤 Subiendo imagen a Docker Hub..."
docker push $DOCKER_IMAGE

echo "🔄 Conectando a Digital Ocean Droplet..."
ssh $DROPLET_USER@$DROPLET_IP << 'EOF'
    # Detener contenedor anterior
    docker stop sisrestaurantes-backend || true
    docker rm sisrestaurantes-backend || true
    
    # Descargar nueva imagen
    docker pull sisrestaurantes/backend:latest
    
    # Ejecutar nuevo contenedor
    docker run -d \
        --name sisrestaurantes-backend \
        --restart unless-stopped \
        -p 80:5000 \
        -p 443:5000 \
        --env-file /opt/sisrestaurantes/.env \
        sisrestaurantes/backend:latest
    
    # Verificar que esté corriendo
    docker ps | grep sisrestaurantes-backend
EOF

echo "✅ Despliegue completado!"
echo "🌐 Backend disponible en: http://$DROPLET_IP"
