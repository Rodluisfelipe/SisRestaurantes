@echo off
REM Script para iniciar el backend en desarrollo local
echo Iniciando backend en desarrollo local...

REM Navegar al directorio del backend
cd Backend

REM Verificar si node_modules existe
if not exist "node_modules" (
    echo Instalando dependencias del backend...
    npm install
)

REM Iniciar el servidor
echo Iniciando servidor en puerto 5000...
npm run dev

pause
