#!/bin/bash

# Script de despliegue para Vercel
echo "🚀 Desplegando frontend a Vercel..."

# Variables (ACTUALIZAR CON TUS DATOS)
BACKEND_URL="http://157.245.125.216"  # ✅ IP de Digital Ocean configurada
PROJECT_NAME="sisrestaurantes-frontend"

echo "📋 Verificando configuración..."

# Verificar que existe Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Error: Vercel CLI no está instalado"
    echo "📝 Instala con: npm i -g vercel"
    exit 1
fi

echo "🔧 Configurando variables de entorno..."

# Crear archivo .env.local para Vercel
cat > .env.local << EOF
VITE_API_URL=$BACKEND_URL
VITE_APP_NAME=Sistema de Restaurantes
VITE_APP_VERSION=1.0.0
EOF

echo "📦 Construyendo proyecto..."
npm run build

echo "🚀 Desplegando a Vercel..."
vercel --prod

echo ""
echo "✅ Despliegue del frontend completado!"
echo "🌐 Frontend disponible en: https://tu-dominio-vercel.vercel.app"
echo ""
echo "📋 Próximos pasos:"
echo "1. Actualizar variables de entorno en Vercel Dashboard"
echo "2. Configurar dominio personalizado (opcional)"
echo "3. Probar la aplicación completa"
echo ""
echo "🔧 Comandos útiles:"
echo "   Ver logs: vercel logs"
echo "   Reiniciar: vercel --prod"
echo "   Variables: vercel env ls"