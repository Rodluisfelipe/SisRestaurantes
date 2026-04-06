#!/bin/bash
# Test epaycoService require inside the image
docker run --rm sisrestaurantes-backend node -e "
try { 
  require('./services/epaycoService'); 
  console.log('epaycoService OK');
} catch(err) { 
  console.log('FAIL: ' + err.message); 
}
"

# Also test what requires fail
docker run --rm sisrestaurantes-backend node -e "
const fs = require('fs');
const path = require('path');
const servicesDir = '/app/services';
const files = fs.readdirSync(servicesDir);
files.forEach(f => {
  try {
    require(path.join(servicesDir, f));
    console.log('OK: ' + f);
  } catch(err) {
    console.log('FAIL: ' + f + ' -> ' + err.message.split('\n')[0]);
  }
});
"
