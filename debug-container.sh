#!/bin/bash
# Check if the container even gets env vars
docker start backend-backend-1 2>/dev/null
sleep 2
echo "--- Container status ---"
docker ps -a --filter name=backend-backend-1 --format "{{.Status}}"

echo "--- Last restart logs ---"
docker logs backend-backend-1 --tail 30 2>&1

echo "--- Check env in container ---"
docker exec backend-backend-1 env 2>/dev/null | grep -E "RESEND|EMAIL|MONGO|JWT|NODE_ENV" || echo "Container not running, cant exec"
