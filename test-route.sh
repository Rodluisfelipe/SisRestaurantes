#!/bin/bash
# Test full server.js startup with env vars
docker run --rm --env-file /opt/sisrestaurantes/Backend/.env sisrestaurantes-backend node -e "
try {
  // Test the specific require chain that fails
  const epayco = require('./Routes/epaycoPayments');
  console.log('epaycoPayments loaded OK');
} catch(err) {
  console.log('FAIL at: ' + err.message);
  console.log('Require stack: ' + JSON.stringify(err.requireStack));
}
"
