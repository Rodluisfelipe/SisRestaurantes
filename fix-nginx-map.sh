#!/bin/bash
# Restore from backup
cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf

# Write map directive to a temp file
cat > /tmp/nginx-map-block.txt << 'MAPEOF'

    # WebSocket support: conditionally set Connection header
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }
MAPEOF

# Insert after 'http {' line
sed -i '/^http {/r /tmp/nginx-map-block.txt' /etc/nginx/nginx.conf

# Update SSL site config to use $connection_upgrade instead of literal "upgrade"
sed -i 's/proxy_set_header Connection "upgrade";/proxy_set_header Connection $connection_upgrade;/g' /etc/nginx/sites-enabled/sisrestaurantes-ssl-ip

# Test config
nginx -t
