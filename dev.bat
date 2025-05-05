@echo off
echo Iniciando servicios de SisRestaurantes...

echo.
echo 1) Iniciando Backend...
start cmd /k "cd Backend && npm run dev"

echo.
echo 2) Iniciando Frontend...
start cmd /k "cd Frontend && npm run dev"

echo.
echo Servicios iniciados! Accede a:
echo - Frontend: http://localhost:3000
echo - Backend: http://localhost:5000
echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause > nul
