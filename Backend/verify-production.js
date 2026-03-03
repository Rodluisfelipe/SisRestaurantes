const d = require('./services/dlocalService');
const e = require('./services/epaycoService');
console.log('=== PRODUCTION VERIFICATION ===');
console.log('dLocal isTest:', d.config.isTest);
console.log('dLocal baseUrl:', d.config.baseUrl);
console.log('dLocal apiKey starts:', d.config.apiKey.substring(0, 8));
console.log('ePayco isTest:', e.config.isTest);
console.log('ePayco publicKey starts:', e.config.publicKey.substring(0, 8));
console.log('=== DONE ===');
