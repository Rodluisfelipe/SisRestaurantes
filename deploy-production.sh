#!/bin/bash

# Script de despliegue completo para producción
echo "🚀 Desplegando Sistema de Restaurantes a Producción..."

# Variables (ACTUALIZAR CON TUS DATOS)
DROPLET_IP="your-droplet-ip"  # Cambiar por tu IP de Digital Ocean
DROPLET_USER="root"
FRONTEND_URL="https://tu-dominio-vercel.vercel.app"  # Cambiar por tu URL de Vercel

echo "📋 Verificando archivos de configuración..."

# Verificar archivos necesarios
if [ ! -f "Backend/.env.production" ]; then
    echo "❌ Error: No se encontró Backend/.env.production"
    echo "📝 Crea el archivo basado en Backend/.env.production.example"
    exit 1
fi

if [ ! -f "Frontend/vercel.json" ]; then
    echo "❌ Error: No se encontró Frontend/vercel.json"
    exit 1
fi

echo "🔧 Actualizando configuraciones..."

# Actualizar .env.production con la URL del frontend
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|g" Backend/.env.production
sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$FRONTEND_URL|g" Backend/.env.production

# Actualizar deploy-digitalocean.sh con la IP correcta
sed -i "s|DROPLET_IP=\".*\"|DROPLET_IP=\"$DROPLET_IP\"|g" Backend/deploy-digitalocean.sh

# Actualizar deploy-vercel.sh con la IP del backend
sed -i "s|BACKEND_URL=\".*\"|BACKEND_URL=\"http://$DROPLET_IP\"|g" Frontend/deploy-vercel.sh

echo "📦 Desplegando Backend a Digital Ocean..."
cd Backend
chmod +x deploy-digitalocean.sh
./deploy-digitalocean.sh

echo "📦 Desplegando Frontend a Vercel..."
cd ../Frontend
chmod +x deploy-vercel.sh
./deploy-vercel.sh

echo ""
echo "✅ Despliegue completo finalizado!"
echo ""
echo "🌐 URLs de la aplicación:"
echo "   Backend: http://$DROPLET_IP"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "📋 Próximos pasos:"
echo "1. Verificar que ambos servicios estén funcionando"
echo "2. Probar la aplicación completa"
echo "3. Configurar dominio personalizado (opcional)"
echo "4. Configurar SSL/HTTPS (recomendado)"
echo ""
echo "🔧 Comandos de verificación:"
echo "   Backend: curl http://$DROPLET_IP/api/health"
echo "   Frontend: Abrir $FRONTEND_URL en el navegador"
echo ""
echo "📞 Soporte:"
echo "   Logs Backend: ssh $DROPLET_USER@$DROPLET_IP 'docker logs sisrestaurantes-backend -f'"
echo "   Logs Frontend: vercel logs"
