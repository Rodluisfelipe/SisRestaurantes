@echo off
echo Iniciando servicios de SisRestaurantes (Sistema Unificado)...

echo.
echo Instalando dependencias del Backend...
cd Backend && npm install --force
cd ..

echo.
echo Instalando dependencias del Frontend...
cd Frontend && npm install --force
cd ..

echo.
echo 1) Iniciando Backend Unificado...
start /min cmd /k "cd Backend && node server.js"

echo.
echo 2) Iniciando Frontend Unificado...
start /min cmd /k "cd Frontend && npx vite"

echo.
echo Servicios iniciados! Accede a:
echo - Frontend: http://localhost:5173
echo - Backend: http://localhost:5000
echo - Panel SuperAdmin: http://localhost:5173/superadmin
echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause > nul
