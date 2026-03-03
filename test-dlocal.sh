#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"Felipe","password":"Pipe12345*"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("accessToken",d.get("token","")))')

echo "TOKEN: ${TOKEN:0:40}..."

curl -s -X POST http://localhost:5000/api/dlocal/create \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"months":1,"businessId":"699f8ae070c6fcd1db64bb0d"}'

echo ""
echo "--- Logs ---"
docker logs --tail 10 sisrestaurantes-backend-1 2>&1
