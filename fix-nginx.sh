#!/bin/bash
# Remove the broken /downloads/ block (lines 64-71)
sed -i '64,71d' /etc/nginx/sites-enabled/sisrestaurantes-ssl-ip

# Now add the correct block after line 63 (end of /uploads/ block)
sed -i '63a\
\
    location /downloads/ {\
        proxy_pass http://127.0.0.1:5000;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }' /etc/nginx/sites-enabled/sisrestaurantes-ssl-ip

nginx -t && systemctl reload nginx && echo "OK"
