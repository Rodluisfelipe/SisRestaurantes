import re

# Fix nginx.conf - replace broken map block with correct one
with open('/etc/nginx/nginx.conf') as f:
    content = f.read()

# Remove the broken map block
broken = """
    # WebSocket support: conditionally set Connection header
    map   {
        default upgrade;
        '' close;
    }"""

correct = """
    # WebSocket support: conditionally set Connection header
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }"""

if broken.strip() in content:
    content = content.replace(broken.strip(), correct.strip())
    with open('/etc/nginx/nginx.conf', 'w') as f:
        f.write(content)
    print('nginx.conf fixed')
else:
    print('Broken block not found, checking current state...')
    if '$connection_upgrade' in content:
        print('Already has correct map - OK')
    else:
        # Insert after http {
        content = content.replace('http {\n', 'http {\n' + correct + '\n')
        with open('/etc/nginx/nginx.conf', 'w') as f:
            f.write(content)
        print('nginx.conf: map block inserted')

# Fix SSL site config - use $connection_upgrade instead of literal "upgrade"
ssl_path = '/etc/nginx/sites-enabled/sisrestaurantes-ssl-ip'
with open(ssl_path) as f:
    ssl = f.read()

ssl_new = ssl.replace('proxy_set_header Connection "upgrade"', 'proxy_set_header Connection $connection_upgrade')
if ssl_new != ssl:
    with open(ssl_path, 'w') as f:
        f.write(ssl_new)
    print('SSL config: Connection header fixed')
else:
    if '$connection_upgrade' in ssl:
        print('SSL config: already correct')
    else:
        print('SSL config: no changes needed')
