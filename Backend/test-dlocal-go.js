// Test dLocal Go API connection
const axios = require('axios');
const dlocalService = require('./services/dlocalService');

async function test() {
  console.log('=== dLocal Go API Test ===');
  console.log('Base URL:', dlocalService.config.baseUrl);
  
  const headers = dlocalService.generateAuthHeaders();
  console.log('Headers:', JSON.stringify(headers, null, 2));
  
  const body = {
    amount: 31500,
    currency: 'COP',
    country: 'CO',
    order_id: 'TEST-' + Date.now(),
    description: 'Test payment',
    success_url: 'https://menuby.tech/fraise/payment-result?status=1',
    back_url: 'https://menuby.tech/fraise/payment-result?status=2',
    notification_url: 'https://157-245-125-216.nip.io/api/dlocal/webhook',
  };
  
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('Calling:', dlocalService.config.baseUrl + '/v1/payments');
  
  try {
    const res = await axios.post(
      dlocalService.config.baseUrl + '/v1/payments',
      body,
      { headers, timeout: 15000 }
    );
    console.log('SUCCESS! Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('ERROR! Status:', e.response?.status || 'no response');
    console.log('Data:', JSON.stringify(e.response?.data || e.message).substring(0, 1000));
  }
}

test();
