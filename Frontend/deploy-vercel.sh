#!/bin/bash

# Script de despliegue para Vercel
echo "🚀 Desplegando frontend a Vercel..."

# Verificar que Vercel CLI esté instalado
if ! command -v vercel &> /dev/null; then
    echo "⚠️ Vercel CLI no está instalado. Instalando..."
    npm install -g vercel
fi

# Configurar variables de entorno en Vercel
echo "🔧 Configurando variables de entorno..."
read -p "🌐 Ingresa la URL de tu backend en Digital Ocean (ej: https://api.tudominio.com): " BACKEND_URL

vercel env add VITE_ENVIRONMENT production
vercel env add VITE_API_URL $BACKEND_URL
vercel env add VITE_SOCKET_URL $BACKEND_URL

# Desplegar
echo "📤 Desplegando a Vercel..."
vercel --prod

echo "✅ Despliegue completado!"
echo "🌐 Frontend disponible en tu dominio de Vercel"
