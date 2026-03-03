// Test 1: Can we require the route?
try {
  const dashRoute = require('./Routes/dashboard');
  console.log('Route loaded OK, type:', typeof dashRoute);
} catch(e) {
  console.log('REQUIRE ERROR:', e.message);
  console.log(e.stack);
  process.exit(1);
}

// Test 2: Call the endpoint
const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { id: '6820bcb00c5ba4efc49ec037', businessId: '6820bcaf0c5ba4efc49ec035', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Token generated, testing endpoint...');

const dashReq = http.request({
  hostname: 'localhost', port: 5000, path: '/api/dashboard/stats',
  method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
  console.log('Status:', res.statusCode);
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    try {
      const stats = JSON.parse(b);
      console.log(JSON.stringify(stats, null, 2));
    } catch { console.log('Raw:', b.substring(0, 500)); }
    process.exit(0);
  });
});
dashReq.end();
