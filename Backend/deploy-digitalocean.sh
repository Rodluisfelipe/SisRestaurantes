-#!/bin/bash

# Script de despliegue completo para Digital Ocean
echo "🚀 Desplegando Sistema de Restaurantes a Digital Ocean..."

# Variables (ACTUALIZAR CON TUS DATOS)
DROPLET_IP="157.245.125.216"  # ✅ IP de Digital Ocean configurada
DROPLET_USER="root"
APP_NAME="sisrestaurantes-backend"
DOCKER_IMAGE="sisrestaurantes/backend:latest"
FRONTEND_URL="https://www.menuby.tech"  # ✅ Dominio personalizado configurado

echo "📋 Verificando archivos de configuración..."

# Verificar que existe el archivo .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Error: No se encontró .env.production"
    echo "📝 Crea el archivo .env.production basado en .env.production.example"
    exit 1
fi

echo "📦 Construyendo imagen Docker del backend..."
docker build -t $DOCKER_IMAGE .

echo "📤 Subiendo imagen a Docker Hub..."
docker push $DOCKER_IMAGE

echo "🔄 Conectando a Digital Ocean Droplet..."
ssh $DROPLET_USER@$DROPLET_IP << EOF
    echo "🛑 Deteniendo contenedor anterior..."
    docker stop sisrestaurantes-backend || true
    docker rm sisrestaurantes-backend || true
    
    echo "📥 Descargando nueva imagen..."
    docker pull sisrestaurantes/backend:latest
    
    echo "🚀 Ejecutando nuevo contenedor..."
    docker run -d \\
        --name sisrestaurantes-backend \\
        --restart unless-stopped \\
        -p 80:5000 \\
        -p 443:5000 \\
        --env-file /opt/sisrestaurantes/.env \\
        sisrestaurantes/backend:latest
    
    echo "✅ Verificando que esté corriendo..."
    sleep 5
    docker ps | grep sisrestaurantes-backend
    
    echo "🔍 Verificando logs..."
    docker logs sisrestaurantes-backend --tail 20
EOF

echo ""
echo "✅ Despliegue del backend completado!"
echo "🌐 Backend disponible en: http://$DROPLET_IP"
echo ""
echo "📋 Próximos pasos:"
echo "1. Desplegar frontend en Vercel"
echo "2. Actualizar variables de entorno en Vercel"
echo "3. Probar la aplicación completa"
echo ""
echo "🔧 Comandos útiles:"
echo "   Ver logs: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Reiniciar: ssh $DROPLET_USER@$DROPLET_IP 'docker restart sisrestaurantes-backend'"
