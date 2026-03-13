#!/bin/bash
# Fix the broken map block in nginx.conf
# Replace lines 14-19 (broken map) with correct map directive
python3 -c "
with open('/etc/nginx/nginx.conf') as f:
    lines = f.readlines()

# Find and remove the broken map block (lines with 'map   {' pattern)
new_lines = []
skip = False
inserted = False
for i, line in enumerate(lines):
    if 'map   {' in line or '# WebSocket support: conditionally set Connection header' in line.strip():
        if not inserted:
            # Insert correct map block
            new_lines.append('    # WebSocket support: conditionally set Connection header\n')
            new_lines.append('    map \$http_upgrade \$connection_upgrade {\n')
            new_lines.append('        default upgrade;\n')
            new_lines.append(\"        ''      close;\n\")
            new_lines.append('    }\n')
            new_lines.append('\n')
            inserted = True
        skip = True
        continue
    if skip:
        if line.strip() == '}':
            skip = False
            continue
        if line.strip() in ['default upgrade;', \"'' close;\", \"' close;\"]:
            continue
    new_lines.append(line)

with open('/etc/nginx/nginx.conf', 'w') as f:
    f.writelines(new_lines)
print('Done')
"

# Now update SSL site config
sed -i 's/proxy_set_header Connection "upgrade";/proxy_set_header Connection \$connection_upgrade;/g' /etc/nginx/sites-enabled/sisrestaurantes-ssl-ip

# Test
nginx -t
