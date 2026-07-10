const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteRequestSchema } = require('../validators/quoteValidator');

const validPayload = {
  name: 'Ravi Kumar',
  phone: '+91 98765 43210',
  location: 'Tirupati',
  product: 'Fly Ash Bricks',
  quantity: '10,000',
  deliveryDate: '2099-01-01',
  message: 'Need delivery in the morning.',
};

test('accepts a valid quote request and normalizes phone and quantity', () => {
  const parsed = quoteRequestSchema.parse(validPayload);

  assert.equal(parsed.phone, '9876543210');
  assert.equal(parsed.quantity, 10000);
});

test('defaults blank quote quantity to zero', () => {
  const parsed = quoteRequestSchema.parse({
    ...validPayload,
    quantity: '',
  });

  assert.equal(parsed.quantity, 0);
});

test('accepts zero quote quantity', () => {
  const parsed = quoteRequestSchema.parse({
    ...validPayload,
    quantity: '0',
  });

  assert.equal(parsed.quantity, 0);
});

test('rejects invalid phone number', () => {
  const parsed = quoteRequestSchema.safeParse({
    ...validPayload,
    phone: '12345',
  });

  assert.equal(parsed.success, false);
});

test('rejects past delivery date', () => {
  const parsed = quoteRequestSchema.safeParse({
    ...validPayload,
    deliveryDate: '2020-01-01',
  });

  assert.equal(parsed.success, false);
});

test('rejects quantity above maximum', () => {
  const parsed = quoteRequestSchema.safeParse({
    ...validPayload,
    quantity: 100001,
  });

  assert.equal(parsed.success, false);
});
