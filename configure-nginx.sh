#!/bin/bash

# Script para configurar Nginx correctamente para el backend
# Este script debe ejecutarse en el servidor Digital Ocean

echo "🔧 Configurando Nginx para el backend..."

# Detener Nginx si está corriendo
sudo systemctl stop nginx

# Crear configuración de Nginx para el backend
sudo tee /etc/nginx/sites-available/sisrestaurantes-backend > /dev/null <<EOF
server {
    listen 80;
    server_name 157.245.125.216;

    # Configuración para el backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Configuración para Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Configuración para archivos estáticos (uploads)
    location /uploads/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Configuración para eventos
    location /events {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Habilitar el sitio
sudo ln -sf /etc/nginx/sites-available/sisrestaurantes-backend /etc/nginx/sites-enabled/

# Remover configuración por defecto si existe
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración de Nginx
echo "🔍 Verificando configuración de Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuración de Nginx válida"
    
    # Reiniciar Nginx
    echo "🔄 Reiniciando Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    echo "✅ Nginx configurado correctamente"
    echo "🌐 Backend disponible en: http://157.245.125.216"
else
    echo "❌ Error en la configuración de Nginx"
    exit 1
fi

# Verificar que Nginx esté corriendo
sudo systemctl status nginx --no-pager

echo "🎉 Configuración completada!"
