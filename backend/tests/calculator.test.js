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
};

const thickness = {
  id: 2,
  displayName: '9 inch',
  thicknessValue: 9,
  unit: 'INCH',
  isActive: true,
};

const catalogueDimensions = {
  flyAsh: {
    name: 'Fly Ash Bricks',
    length: 9,
    width: 4.5,
    height: 3,
    dimensionUnit: 'INCH',
    isActive: true,
  },
  solidCement: {
    name: 'Solid Cement Blocks',
    length: 12,
    width: 8,
    height: 6,
    dimensionUnit: 'INCH',
    isActive: true,
  },
  paver: {
    name: 'Paver Blocks',
    length: 9,
    width: 4.5,
    height: 3,
    dimensionUnit: 'INCH',
    isActive: true,
  },
  mud: {
    name: 'Mud Bricks',
    length: 9,
    width: 4.5,
    height: 3,
    dimensionUnit: 'INCH',
    isActive: true,
  },
};

function product(overrides = {}) {
  return {
    id: 1,
    name: 'Fly Ash Bricks',
    slug: 'fly-ash-bricks',
    standardPrice: 8.5,
    unit: 'brick',
    availability: 'IN_STOCK',
    ...overrides,
  };
}

test('accepts wall inputs without a client-supplied quantity', () => {
  const parsed = calculatorRequestSchema.parse(payload);

  assert.equal(parsed.height, 10);
  assert.equal(parsed.heightUnit, 'ft');
  assert.equal(parsed.productId, 1);
  assert.equal('quantity' in parsed, false);
});

test('rejects invalid wall inputs and a client-supplied quantity', () => {
  const invalidMeasurements = calculatorRequestSchema.safeParse({
    ...payload,
    height: 0,
    width: -2,
    widthUnit: 'yard',
  });
  const suppliedQuantity = calculatorRequestSchema.safeParse({
    ...payload,
    quantity: 10000,
  });

  assert.equal(invalidMeasurements.success, false);
  assert.deepEqual(
    invalidMeasurements.error.errors.map((error) => error.path[0]).sort(),
    ['height', 'width', 'widthUnit'],
  );
  assert.equal(suppliedQuantity.success, false);
});

test('calculates Fly Ash Brick quantity and cost from catalogue dimensions', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(
    payload,
    product(),
    thickness,
    catalogueDimensions.flyAsh,
  );

  assert.equal(result.wallArea, 120);
  assert.equal(result.wallVolume, 90);
  assert.equal(result.brickSize, '9 × 4.5 × 3 inch');
  assert.equal(result.baseEstimatedPieces, 1280);
  assert.equal(result.estimatedPieces, 1280);
  assert.equal(result.quantity, 1280);
  assert.equal(result.quantityUnit, 'brick');
  assert.equal(result.estimatedCost, 10880);
});

test('normalizes mixed wall units before calculating', () => {
  const result = calculatorPrivate.calculateMaterialEstimate({
    ...payload,
    height: 3.048,
    heightUnit: 'm',
  }, product(), thickness, catalogueDimensions.flyAsh);

  assert.equal(result.wallArea, 120);
  assert.equal(result.estimatedPieces, 1280);
  assert.equal(result.quantity, 1280);
});

test('calculates Solid Cement Block quantity using the standard catalogue size', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(
    payload,
    product({
      id: 2,
      name: 'Solid Cement Blocks',
      slug: 'solid-cement-blocks',
      standardPrice: 42,
      unit: 'block',
    }),
    thickness,
    catalogueDimensions.solidCement,
  );

  assert.equal(result.brickSize, '12 × 8 × 6 inch');
  assert.equal(result.estimatedPieces, 270);
  assert.equal(result.quantity, 270);
  assert.equal(result.quantityUnit, 'block');
  assert.equal(result.estimatedCost, 11340);
});

test('calculates Paver Block pieces but prices the required square-foot area', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(
    payload,
    product({
      id: 3,
      name: 'Paver Blocks',
      slug: 'paver-blocks',
      standardPrice: 55,
      unit: 'sq.ft',
    }),
    thickness,
    catalogueDimensions.paver,
  );

  assert.equal(result.brickSize, '9 × 4.5 × 3 inch');
  assert.equal(result.baseEstimatedPieces, 426.67);
  assert.equal(result.estimatedPieces, 427);
  assert.equal(result.quantity, 120);
  assert.equal(result.quantityUnit, 'sq.ft');
  assert.equal(result.estimatedCost, 6600);
});

test('calculates Mud Brick quantity and cost from catalogue dimensions', () => {
  const result = calculatorPrivate.calculateMaterialEstimate(
    payload,
    product({
      id: 4,
      name: 'Mud Bricks',
      slug: 'mud-bricks',
      standardPrice: 12,
    }),
    thickness,
    catalogueDimensions.mud,
  );

  assert.equal(result.estimatedPieces, 1280);
  assert.equal(result.quantity, 1280);
  assert.equal(result.quantityUnit, 'brick');
  assert.equal(result.estimatedCost, 15360);
});

test('configures all four catalogue product dimensions without waste percentage', () => {
  assert.deepEqual(
    calculatorPrivate.defaultBrickTypes.map((item) => ({
      name: item.name,
      dimensions: [item.length, item.width, item.height, item.dimensionUnit],
      wastePercent: item.defaultWastePercent,
    })),
    [
      {
        name: 'Fly Ash Bricks',
        dimensions: ['9', '4.5', '3', 'INCH'],
        wastePercent: '0',
      },
      {
        name: 'Solid Cement Blocks',
        dimensions: ['12', '8', '6', 'INCH'],
        wastePercent: '0',
      },
      {
        name: 'Paver Blocks',
        dimensions: ['9', '4.5', '3', 'INCH'],
        wastePercent: '0',
      },
      {
        name: 'Mud Bricks',
        dimensions: ['9', '4.5', '3', 'INCH'],
        wastePercent: '0',
      },
    ],
  );
});

test('rejects products with missing catalogue dimensions', () => {
  assert.throws(
    () => calculatorPrivate.calculateMaterialEstimate(payload, product(), thickness),
    /dimensions are not configured/,
  );
});

test('rejects unavailable products', () => {
  assert.throws(
    () => calculatorPrivate.calculateMaterialEstimate(
      payload,
      product({ availability: 'OUT_OF_STOCK' }),
      thickness,
      catalogueDimensions.flyAsh,
    ),
    /inactive or unavailable/,
  );
});
