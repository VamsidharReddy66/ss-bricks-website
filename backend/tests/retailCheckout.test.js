const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRetailPackQuantities,
  isRetailPackQuantity,
} = require('../config/retailPacks');
const { retailCheckoutSchema } = require('../validators/retailCheckoutValidator');

test('defines two retail packs for every public product line', () => {
  assert.deepEqual(getRetailPackQuantities('fly-ash-bricks'), [500, 1000]);
  assert.deepEqual(getRetailPackQuantities('solid-cement-blocks'), [100, 250]);
  assert.deepEqual(getRetailPackQuantities('paver-blocks'), [100, 250]);
  assert.deepEqual(getRetailPackQuantities('mud-bricks'), [500, 1000]);
});

test('only accepts an allowlisted pack quantity', () => {
  assert.equal(isRetailPackQuantity('fly-ash-bricks', 500), true);
  assert.equal(isRetailPackQuantity('fly-ash-bricks', 750), false);
  assert.equal(isRetailPackQuantity('unknown-product', 500), false);
});

test('accepts a complete retail checkout request', () => {
  const parsed = retailCheckoutSchema.parse({
    productSlug: 'paver-blocks',
    quantity: 100,
    name: 'Ravi Kumar',
    phone: '+91 98765 43210',
    email: 'ravi@example.com',
    location: 'Tirupati',
    deliveryDate: '2099-12-31',
  });

  assert.equal(parsed.phone, '9876543210');
  assert.equal(parsed.quantity, 100);
});

test('rejects missing customer details and invalid dates', () => {
  const parsed = retailCheckoutSchema.safeParse({
    productSlug: 'fly-ash-bricks',
    quantity: 500,
    name: 'R',
    phone: '123',
    email: '',
    location: '',
    deliveryDate: '2020-01-01',
  });

  assert.equal(parsed.success, false);
  const fields = parsed.error.errors.map((issue) => issue.path[0]);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('phone'));
  assert.ok(fields.includes('location'));
  assert.ok(fields.includes('deliveryDate'));
});
