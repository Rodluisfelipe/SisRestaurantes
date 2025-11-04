$env:SSH_KEY = "$env:USERPROFILE\.ssh\sisrestaurantes_key"
$env:REMOTE_HOST = "157.245.125.216"

Write-Host "Stopping and removing existing container..." -ForegroundColor Yellow
ssh -i $env:SSH_KEY root@$env:REMOTE_HOST "docker stop sisrestaurantes-backend 2>/dev/null; docker rm sisrestaurantes-backend 2>/dev/null"

Write-Host "Starting new container with test Wompi keys..." -ForegroundColor Yellow
ssh -i $env:SSH_KEY root@$env:REMOTE_HOST @"
docker run -d \
  --name sisrestaurantes-backend \
  --restart unless-stopped \
  -p 5001:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGODB_URI='mongodb+srv://pipe95141007:Pipe9514.@cluster0.hp7leo2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0' \
  -e JWT_SECRET='jwt_secret_super_seguro_para_produccion_2024_sisrestaurantes_pipe95141007' \
  -e ALLOWED_ORIGINS='https://www.menuby.tech,https://menuby.tech,http://157.245.125.216,https://157-245-125-216.nip.io,http://157-245-125-216.nip.io,http://localhost:5173' \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=pipe95141007@gmail.com \
  -e SMTP_PASS='qngt lfzf fhlm icsg' \
  -e EMAIL_FROM='Restaurantes System' \
  -e VAPID_PUBLIC=BLTgq1b0PBg0uu-zpZr7WpbF2yvY4rCgRkj0_xUHB3E7qHOxBiXfOAKOBJqOySLwtjQiGgBoOPYxCZcCb-HyGYc \
  -e VAPID_PRIVATE=X_O-iiJl7zVgSoGzYl5NRlicOsiODyny09PNE_ASYls \
  -e VAPID_MAILTO=mailto:admin@menuby.tech \
  -e WOMPI_API_URL=https://sandbox.wompi.co/v1 \
  -e WOMPI_PUBLIC_KEY=pub_test_nGhaMAQ0003HBVgkJEfZfkIEkkJ5m8RC \
  -e WOMPI_PRIVATE_KEY=prv_test_rA4REo5u60AvhLy1D4guKttW4DV2xt7h \
  -e WOMPI_INTEGRITY_KEY=test_integrity_9714xodcrJfHlJRthaMpaby3xpn1ql0f \
  -e WOMPI_EVENTS_SECRET=test_events_EC0E9psos9CYQ07c7iO6R0dLAdA8mibZ \
  -e SUBSCRIPTION_MONTHLY_PRICE=27000 \
  -e SUBSCRIPTION_ANNUAL_PRICE=308000 \
  sisrestaurantes-backend:latest
"@

Write-Host "Waiting 10 seconds for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Checking container logs..." -ForegroundColor Yellow
ssh -i $env:SSH_KEY root@$env:REMOTE_HOST "docker logs sisrestaurantes-backend --tail 20"

Write-Host "Checking health endpoint..." -ForegroundColor Yellow
ssh -i $env:SSH_KEY root@$env:REMOTE_HOST "curl -s https://157-245-125-216.nip.io/api/health | head -100"

Write-Host "Done!" -ForegroundColor Green



