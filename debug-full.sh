#!/bin/bash
# Debug: try loading server.js and show the actual error
echo "=== Testing full server load ==="
docker run --rm --env-file /opt/sisrestaurantes/Backend/.env sisrestaurantes-backend node -e '
process.on("uncaughtException", function(err) {
  console.log("ERROR:", err.code, err.message.split("\n")[0]);
  if (err.requireStack) console.log("Require stack:", JSON.stringify(err.requireStack));
  process.exit(1);
});
require("./server.js");
' 2>&1 | head -20

echo ""
echo "=== Testing Routes individually ==="
for f in /opt/sisrestaurantes/Backend/Routes/*.js; do
  name=$(basename "$f")
  docker run --rm --env-file /opt/sisrestaurantes/Backend/.env sisrestaurantes-backend node -e "
    try { require('./Routes/$name'); console.log('OK: $name'); }
    catch(e) { console.log('FAIL: $name -> ' + e.code + ': ' + e.message.split('\n')[0]); }
  " 2>&1
done
