const test = require('node:test');
const assert = require('node:assert/strict');
const { productUpdateSchema } = require('../validators/productValidator');

const validPayload = {
  standardPrice: 8.5,
  bulkPrice: 8.1,
  bulkQuantity: 10000,
  availability: 'IN_STOCK',
  description: 'Premium fly ash bricks for residential and commercial construction.',
};

test('accepts a valid product update', () => {
  const parsed = productUpdateSchema.parse(validPayload);

  assert.equal(parsed.standardPrice, 8.5);
  assert.equal(parsed.bulkPrice, 8.1);
});

test('rejects negative prices', () => {
  const parsed = productUpdateSchema.safeParse({
    ...validPayload,
    standardPrice: -1,
  });

  assert.equal(parsed.success, false);
});

test('rejects bulk price above standard price', () => {
  const parsed = productUpdateSchema.safeParse({
    ...validPayload,
    bulkPrice: 9,
  });

  assert.equal(parsed.success, false);
});

test('rejects invalid availability', () => {
  const parsed = productUpdateSchema.safeParse({
    ...validPayload,
    availability: 'LIMITED',
  });

  assert.equal(parsed.success, false);
});
