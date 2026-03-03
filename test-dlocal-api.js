// Quick test to verify dLocal sandbox API connectivity
const crypto = require('crypto');
const http = require('https');

const apiKey = 'dliQhOSbPcFyfSWLOAubQzelnSInNVvd';
const secretKey = 'XkrUXh7FPDRmLIHEycVybLMXMdNWt1N07MbsrkQx';

const body = JSON.stringify({
  amount: 31500,
  currency: 'COP',
  country: 'CO',
  payment_method_flow: 'REDIRECT',
  order_id: 'TEST-' + Date.now(),
  description: 'Test payment',
  notification_url: 'https://157-245-125-216.nip.io/api/dlocal/webhook',
  callback_url: 'https://157-245-125-216.nip.io/api/dlocal/response?ref=TEST',
  payer: { name: 'Test User', email: 'test@test.com' },
});

const dateStr = new Date().toISOString();
const signatureContent = apiKey + dateStr + body;
const signature = crypto.createHmac('sha256', secretKey).update(signatureContent).digest('hex');

const options = {
  hostname: 'sandbox.dlocalgo.com',
  path: '/v1/payments',
  method: 'POST',
  headers: {
    'X-Date': dateStr,
    'X-Login': apiKey,
    'X-Trans-Key': secretKey,
    'Authorization': `V2-HMAC-SHA256, Signature: ${signature}`,
    'Content-Type': 'application/json',
    'X-Version': '2.1',
    'User-Agent': 'MenuBy/1.0',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.substring(0, 500));
  });
});
req.on('error', (e) => console.log('Error:', e.message));
req.write(body);
req.end();
