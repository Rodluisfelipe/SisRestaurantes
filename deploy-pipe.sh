#!/bin/bash

# Script de despliegue personalizado para PIPE95141007
echo "🚀 Desplegando Sistema de Restaurantes de PIPE95141007..."

# Variables PERSONALIZADAS (ACTUALIZAR CON TUS DATOS)
DROPLET_IP="157.245.125.216"  # ✅ IP de Digital Ocean configurada
DROPLET_USER="root"
FRONTEND_URL="https://www.menuby.tech"  # ✅ Dominio personalizado configurado

echo "📋 Verificando configuración personalizada..."

# Verificar que existe el archivo .env.production.personalizado
if [ ! -f "Backend/.env.production.personalizado" ]; then
    echo "❌ Error: No se encontró Backend/.env.production.personalizado"
    exit 1
fi

# Copiar archivo personalizado como .env.production
cp Backend/.env.production.personalizado Backend/.env.production

echo "🔧 Actualizando configuraciones con tus datos..."

# Actualizar .env.production con la URL del frontend
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|g" Backend/.env.production
sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$FRONTEND_URL|g" Backend/.env.production

# Actualizar deploy-digitalocean.sh con la IP correcta
sed -i "s|DROPLET_IP=\".*\"|DROPLET_IP=\"$DROPLET_IP\"|g" Backend/deploy-digitalocean.sh

# Actualizar deploy-vercel.sh con la IP del backend
sed -i "s|BACKEND_URL=\".*\"|BACKEND_URL=\"http://$DROPLET_IP\"|g" Frontend/deploy-vercel.sh

echo "📦 Desplegando Backend a Digital Ocean..."
cd Backend
./deploy-digitalocean.sh

echo "📦 Desplegando Frontend a Vercel..."
cd ../Frontend
./deploy-vercel.sh

echo ""
echo "✅ Despliegue completo finalizado!"
echo ""
echo "🌐 URLs de tu aplicación:"
echo "   Backend: http://$DROPLET_IP"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "📋 Próximos pasos:"
echo "1. Verificar que ambos servicios estén funcionando"
echo "2. Probar la aplicación completa"
echo "3. Configurar dominio personalizado (opcional)"
echo ""
echo "🔧 Comandos de verificación:"
echo "   Backend: curl http://$DROPLET_IP/api/health"
echo "   Frontend: Abrir $FRONTEND_URL en el navegador"
echo ""
echo "📞 Soporte:"
echo "   Logs Backend: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Logs Frontend: vercel logs"
