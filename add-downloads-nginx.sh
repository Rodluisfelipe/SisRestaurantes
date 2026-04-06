#!/bin/bash
# Add /downloads/ location block after the /uploads/ block (line 63)
sed -i '63a\
\
    location /downloads/ {\
        proxy_pass http://127.0.0.1:5000;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' /etc/nginx/sites-enabled/sisrestaurantes-ssl-ip

nginx -t && systemctl reload nginx
echo "Done"
