const m = require('./middleware/authMiddleware');
console.log('authMiddleware type:', typeof m);
console.log('requireRole type:', typeof m.requireRole);

// Test requireRole behavior
const mockReq = { user: { role: undefined } };
const mockRes = { status: (c) => ({ json: (d) => console.log('Response:', c, d) }) };
const handler = m.requireRole('admin');
handler(mockReq, mockRes, () => console.log('PASSED - next() called'));
