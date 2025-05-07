@echo off
echo Iniciando servicios de SisRestaurantes...

echo.
echo 1) Iniciando Backend...
start /min cmd /k "cd Backend &&  npm run dev"

echo.
echo 2) Iniciando Frontend...
start /min cmd /k "cd Frontend && npm run dev"
echo.
echo 3) Iniciando Backend...
start /min cmd /k "cd BackendSA  && npm run start"

echo.
echo 4) Iniciando Frontend...
start /min cmd /k "cd FrontendSA && set PORT=5174 && npm run dev"

echo.
echo Servicios iniciados! Accede a:
echo - Frontend: http://localhost:3000
echo - Backend: http://localhost:5000
echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause > nul
