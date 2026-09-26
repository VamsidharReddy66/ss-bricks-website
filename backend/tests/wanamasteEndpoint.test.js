const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../app');
const env = require('../config/env');
const wanamasteService = require('../services/wanamasteService');

test('controlled WAnamaste test endpoint is admin-only and delegates without a real API call', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const originalSend = wanamasteService.sendControlledTestQuotation;
  const calls = [];
  wanamasteService.sendControlledTestQuotation = async (payload) => {
    calls.push(payload);
    return {
      httpStatus: 202,
      success: true,
      responseBody: { status: 'queued' },
      failureCode: null,
    };
  };
  context.after(() => {
    wanamasteService.sendControlledTestQuotation = originalSend;
  });

  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/integrations/wanamaste/test-send`;
  const payload = {
    confirmation: 'SEND_ONE_WANAMASTE_TEST',
    phoneNumber: '919876543210',
    customerName: 'Test Customer',
    quotationNumber: 'TEST-Q-001',
    documentUrl: 'https://quotes.example.com/quotation.pdf',
  };

  const unauthorized = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(calls.length, 0);

  const adminToken = jwt.sign({ id: 'test-admin', email: 'admin@example.test' }, env.jwtSecret, {
    expiresIn: '1m',
  });
  const authorized = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await authorized.json();

  assert.equal(authorized.status, 200);
  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], payload);
});
