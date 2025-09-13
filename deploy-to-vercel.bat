@echo off
REM Script para desplegar frontend a Vercel
echo 🚀 Desplegando frontend a Vercel...

REM Ir al directorio del frontend
cd Frontend

REM Verificar que Vercel CLI esté instalado
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ Vercel CLI no está instalado. Instalando...
    npm install -g vercel
)

REM Login a Vercel (si no está logueado)
echo 🔑 Verificando autenticación con Vercel...
vercel whoami

REM Configurar variables de entorno
echo 🔧 Configurando variables de entorno...
vercel env add VITE_ENVIRONMENT
vercel env add VITE_API_URL
vercel env add VITE_SOCKET_URL

REM Desplegar a producción
echo 📤 Desplegando a producción...
vercel --prod

echo ✅ ¡Despliegue completado!
echo 🌐 Tu aplicación estará disponible en tu dominio de Vercel

pause
