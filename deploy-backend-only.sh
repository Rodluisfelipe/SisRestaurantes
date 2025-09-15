#!/bin/bash

# Script de despliegue SOLO BACKEND para PIPE95141007
echo "🚀 Desplegando SOLO BACKEND a Digital Ocean..."

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

# Copiar archivo personalizado como .env.production
cp Backend/.env.production.personalizado Backend/.env.production

echo "🔧 Configuración actualizada:"
echo "   Backend IP: $DROPLET_IP"
echo "   Frontend URL: $FRONTEND_URL"
echo "   MongoDB: Configurado"
echo "   Email: pipe95141007@gmail.com"

echo ""
echo "📦 Desplegando Backend a Digital Ocean..."
cd Backend
./deploy-digitalocean.sh

echo ""
echo "✅ Despliegue del backend completado!"
echo ""
echo "🌐 URLs de tu aplicación:"
echo "   Backend: http://$DROPLET_IP"
echo "   Frontend: $FRONTEND_URL (se despliega automáticamente desde Git)"
echo ""
echo "🔧 Comandos de verificación:"
echo "   Verificar contenedor: ssh $DROPLET_USER@$DROPLET_IP 'docker ps | grep sisrestaurantes-backend'"
echo "   Ver logs: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Probar API: curl http://$DROPLET_IP/api/health"
echo ""
echo "📞 Soporte:"
echo "   Logs Backend: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Reiniciar: ssh $DROPLET_USER@$DROPLET_IP 'docker restart sisrestaurantes-backend'"
