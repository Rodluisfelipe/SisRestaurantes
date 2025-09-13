@echo off
REM Script para probar conexión SSH a Digital Ocean
echo 🔌 Probando conexión SSH a Digital Ocean...

REM IP del Droplet: sis-restaurant
set DROPLET_IP=157.245.125.216

echo 📡 Conectando a %DROPLET_IP%...
ssh -i "%USERPROFILE%\.ssh\id_rsa_digitalocean" root@%DROPLET_IP%

pause
