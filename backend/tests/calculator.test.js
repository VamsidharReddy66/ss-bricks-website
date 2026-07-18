const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatorRequestSchema } = require('../validators/calculatorValidator');
const { __private: calculatorPrivate } = require('../services/calculatorService');

const payload = {
  height: 10,
  heightUnit: 'ft',
  width: 12,
  widthUnit: 'ft',
  thicknessId: 2,
  productId: 1,
  quantity: 10000,
};

const product = {
  id: 1,
  name: 'Fly Ash Bricks',
  slug: 'fly-ash-bricks',
  standardPrice: 8.5,
  unit: 'brick',
  availability: 'IN_STOCK',
};

const brickType = {
  id: 5,
  name: 'Fly Ash Bricks',
  length: 230,
  width: 110,
  height: 75,
  dimensionUnit: 'MM',
  pricePerPiece: 8.5,
  defaultWastePercent: 5,
  isActive: true,
};

const thickness = {
  id: 2,
  displayName: '9 inch',
  thicknessValue: 9,
  unit: 'INCH',
  isActive: true,
};

test('accepts a valid material calculator request', () => {
  const parsed = calculatorRequestSchema.parse(payload);

  assert.equal(parsed.height, 10);
  assert.equal(parsed.heightUnit, 'ft');
  assert.equal(parsed.quantity, 10000);
});

test('rejects zero, negative, and unsupported calculator inputs', () => {
  const parsed = calculatorRequestSchema.safeParse({
    ...payload,
    height: 0,
    width: -2,
    widthUnit: 'yard',
    quantity: 1.5,
  });

  assert.equal(parsed.success, false);
  assert.deepEqual(
    parsed.error.errors.map((error) => error.path[0]).sort(),
    ['height', 'quantity', 'width', 'widthUnit'],
  );
});

test('calculates wall requirements and uses the selected product price', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(payload, product, thickness, brickType);

  assert.equal(result.wallArea, 120);
  assert.equal(result.wallVolume, 90);
  assert.equal(result.brickSize, '230 × 110 × 75 mm');
  assert.equal(result.baseEstimatedBricks, 1343.09);
  assert.equal(result.estimatedBricks, 1344);
  assert.equal(result.quantity, 10000);
  assert.equal(result.quantityUnit, 'brick');
  assert.equal(result.estimatedCost, 85000);
});

test('normalizes mixed wall units before calculating', () => {
  const result = calculatorPrivate.calculateMaterialEstimate({
    ...payload,
    height: 3.048,
    heightUnit: 'm',
  }, product, thickness, brickType);

  assert.equal(result.wallArea, 120);
  assert.equal(result.estimatedBricks, 1344);
});

test('calculates product cost without inventing missing dimensions', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(payload, {
    ...product,
    id: 2,
    name: 'Solid Cement Blocks',
    standardPrice: 42,
    unit: 'block',
  }, thickness);

  assert.equal(result.brickSize, null);
  assert.equal(result.estimatedBricks, null);
  assert.equal(result.quantityUnit, 'block');
  assert.equal(result.estimatedCost, 420000);
});

test('rejects unavailable products', () => {
  assert.throws(
    () => calculatorPrivate.calculateMaterialEstimate(payload, {
      ...product,
      availability: 'OUT_OF_STOCK',
    }, thickness, brickType),
    /inactive or unavailable/,
  );
});
