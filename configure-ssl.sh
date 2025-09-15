#!/bin/bash

# Script para configurar SSL con Let's Encrypt
# Este script debe ejecutarse en el servidor Digital Ocean

DOMAIN=${1:-"api.menuby.tech"}  # Usar el dominio como parámetro o default
EMAIL="admin@menuby.tech"  # Cambiar por tu email

echo "🔒 Configurando SSL para el dominio: $DOMAIN"

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt update && apt upgrade -y

# Instalar Certbot y plugin de Nginx
echo "🔧 Instalando Certbot..."
apt install -y certbot python3-certbot-nginx

# Detener Nginx temporalmente
echo "⏸️ Deteniendo Nginx..."
systemctl stop nginx

# Configurar Nginx básico para el dominio
echo "🌐 Configurando Nginx para $DOMAIN..."
tee /etc/nginx/sites-available/sisrestaurantes-ssl > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirección temporal para Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redireccionar todo lo demás a HTTPS (después de obtener el certificado)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

# Habilitar el sitio
ln -sf /etc/nginx/sites-available/sisrestaurantes-ssl /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Crear directorio para Let's Encrypt
mkdir -p /var/www/html

# Iniciar Nginx
echo "🚀 Iniciando Nginx..."
systemctl start nginx

# Obtener certificado SSL
echo "🔐 Obteniendo certificado SSL de Let's Encrypt..."
certbot certonly --webroot -w /var/www/html -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

if [ $? -eq 0 ]; then
    echo "✅ Certificado SSL obtenido exitosamente"
    
    # Configurar Nginx con SSL
    echo "🔧 Configurando Nginx con SSL..."
    tee /etc/nginx/sites-available/sisrestaurantes-ssl > /dev/null <<EOF
# Redirección HTTP a HTTPS
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# Configuración HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # Configuración SSL
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;

    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

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

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF

    # Verificar configuración
    echo "🔍 Verificando configuración de Nginx..."
    nginx -t

    if [ $? -eq 0 ]; then
        echo "✅ Configuración válida"
        
        # Reiniciar Nginx
        echo "🔄 Reiniciando Nginx..."
        systemctl reload nginx
        
        # Configurar renovación automática
        echo "🔄 Configurando renovación automática..."
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        echo "✅ SSL configurado correctamente"
        echo "🔒 Backend disponible en: https://$DOMAIN"
        echo "🌐 API Health: https://$DOMAIN/api/health"
        
    else
        echo "❌ Error en la configuración de Nginx"
        exit 1
    fi

else
    echo "❌ Error al obtener certificado SSL"
    echo "💡 Verifica que el dominio $DOMAIN apunte a esta IP: $(curl -s ifconfig.me)"
    exit 1
fi

echo "🎉 Configuración SSL completada!"
