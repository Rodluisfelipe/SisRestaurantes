@echo off
REM Script para mantener vivo el servidor mediante peticiones periódicas
REM Guardar este archivo como keep-alive.bat y programarlo para ejecutarse cada 20-25 minutos

echo [%date% %time%] Iniciando ping al backend...

REM Hacer petición al endpoint de health check del backend
curl -s https://sisrestaurantes.onrender.com/api/health
echo.

echo [%date% %time%] Iniciando ping al frontend...

REM Hacer petición al endpoint de health check del frontend
curl -s https://www.menuby.tech/health
echo.

echo [%date% %time%] Pings completados exitosamente!
