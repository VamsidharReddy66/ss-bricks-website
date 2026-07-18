const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

const METERS_PER_UNIT = Object.freeze({
  ft: 0.3048,
  m: 1,
  MM: 0.001,
  CM: 0.01,
  INCH: 0.0254,
});

const SQUARE_FEET_PER_SQUARE_METER = 10.7639104167;
const CUBIC_FEET_PER_CUBIC_METER = 35.3146667215;

const defaultBrickTypes = [
  {
    name: 'Fly Ash Bricks',
    length: '230',
    width: '110',
    height: '75',
    dimensionUnit: 'MM',
    pricePerPiece: '8.50',
    defaultWastePercent: '5',
  },
];

const defaultThicknessOptions = [
  { displayName: '4.5 inch', thicknessValue: '4.5', unit: 'INCH' },
  { displayName: '9 inch', thicknessValue: '9', unit: 'INCH' },
  { displayName: '13.5 inch', thicknessValue: '13.5', unit: 'INCH' },
];

function decimal(value) {
  return new Prisma.Decimal(value);
}

function number(value) {
  return Number(value);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function compactNumber(value) {
  return number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 3,
    useGrouping: false,
  });
}

function clientError(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.field = field;
  return error;
}

function requirePositive(value, message, field) {
  const parsed = number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw clientError(message, field);
  }
  return parsed;
}

function unitToMeters(value, unit, field) {
  const multiplier = METERS_PER_UNIT[unit];
  if (!multiplier) {
    throw clientError('Measurement unit is not supported.', field);
  }
  return value * multiplier;
}

function toCalculatorProductDto(product, brickType) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    pricePerUnit: number(product.standardPrice),
    unit: product.unit,
    availability: product.availability,
    dimensionsConfigured: Boolean(brickType),
  };
}

function toThicknessDto(thickness) {
  return {
    id: thickness.id,
    displayName: thickness.displayName,
    thicknessValue: number(thickness.thicknessValue),
    unit: thickness.unit.toLowerCase(),
  };
}

async function ensureDefaultCalculatorConfig() {
  for (const brickType of defaultBrickTypes) {
    await prisma.brickType.upsert({
      where: { name: brickType.name },
      update: {},
      create: {
        ...brickType,
        length: decimal(brickType.length),
        width: decimal(brickType.width),
        height: decimal(brickType.height),
        pricePerPiece: decimal(brickType.pricePerPiece),
        defaultWastePercent: decimal(brickType.defaultWastePercent),
      },
    });
  }

  for (const thickness of defaultThicknessOptions) {
    await prisma.wallThickness.upsert({
      where: { displayName: thickness.displayName },
      update: {},
      create: {
        ...thickness,
        thicknessValue: decimal(thickness.thicknessValue),
      },
    });
  }
}

async function getCalculatorConfig() {
  const [products, brickTypes, thicknessOptions] = await Promise.all([
    prisma.product.findMany({
      orderBy: { id: 'asc' },
    }),
    prisma.brickType.findMany({
      where: { isActive: true },
    }),
    prisma.wallThickness.findMany({
      where: { isActive: true },
      orderBy: { thicknessValue: 'asc' },
    }),
  ]);
  const brickTypesByName = new Map(brickTypes.map((brickType) => [brickType.name, brickType]));

  return {
    products: products.map((product) => toCalculatorProductDto(
      product,
      brickTypesByName.get(product.name),
    )),
    thicknessOptions: thicknessOptions.map(toThicknessDto),
  };
}

// Placeholder business formula. Replace only this function when the official formula is supplied.
function calculateMaterialEstimate(payload, product, thickness, brickType = null) {
  if (!product || product.availability !== 'IN_STOCK') {
    throw clientError('Selected product type is inactive or unavailable.', 'productId');
  }
  if (!thickness?.isActive) {
    throw clientError('Selected wall thickness is inactive or unavailable.', 'thicknessId');
  }

  const heightMeters = unitToMeters(payload.height, payload.heightUnit, 'heightUnit');
  const widthMeters = unitToMeters(payload.width, payload.widthUnit, 'widthUnit');
  const thicknessValue = requirePositive(
    thickness.thicknessValue,
    'Selected wall thickness is missing a valid value.',
    'thicknessId',
  );
  const thicknessMeters = unitToMeters(thicknessValue, thickness.unit, 'thicknessId');

  const pricePerUnit = requirePositive(
    product.standardPrice,
    'Selected product type is missing a valid price.',
    'productId',
  );

  const wallAreaSquareMeters = heightMeters * widthMeters;
  const wallVolumeCubicMeters = wallAreaSquareMeters * thicknessMeters;
  let brickSize = null;
  let baseEstimatedBricks = null;
  let estimatedBricks = null;

  if (brickType?.isActive) {
    const brickLength = requirePositive(brickType.length, 'Brick length is missing.', 'productId');
    const brickWidth = requirePositive(brickType.width, 'Brick width is missing.', 'productId');
    const brickHeight = requirePositive(brickType.height, 'Brick height is missing.', 'productId');
    const brickLengthMeters = unitToMeters(brickLength, brickType.dimensionUnit, 'productId');
    const brickWidthMeters = unitToMeters(brickWidth, brickType.dimensionUnit, 'productId');
    const brickHeightMeters = unitToMeters(brickHeight, brickType.dimensionUnit, 'productId');
    const brickVolumeCubicMeters = brickLengthMeters * brickWidthMeters * brickHeightMeters;
    baseEstimatedBricks = wallVolumeCubicMeters / brickVolumeCubicMeters;
    estimatedBricks = Math.ceil(baseEstimatedBricks);
    brickSize = `${compactNumber(brickType.length)} \u00d7 ${compactNumber(brickType.width)} \u00d7 ${compactNumber(brickType.height)} ${brickType.dimensionUnit.toLowerCase()}`;
  }

  const estimatedCost = payload.quantity * pricePerUnit;

  return {
    wallArea: round(wallAreaSquareMeters * SQUARE_FEET_PER_SQUARE_METER),
    wallAreaUnit: 'sq ft',
    wallVolume: round(wallVolumeCubicMeters * CUBIC_FEET_PER_CUBIC_METER),
    wallVolumeUnit: 'cu ft',
    brickType: product.name,
    brickSize,
    baseEstimatedBricks: baseEstimatedBricks === null ? null : round(baseEstimatedBricks),
    estimatedBricks,
    quantity: payload.quantity,
    quantityUnit: product.unit,
    pricePerUnit: round(pricePerUnit),
    estimatedCost: round(estimatedCost),
  };
}

async function calculate(payload) {
  const [product, thickness] = await Promise.all([
    prisma.product.findUnique({ where: { id: payload.productId } }),
    prisma.wallThickness.findUnique({ where: { id: payload.thicknessId } }),
  ]);
  const brickType = product
    ? await prisma.brickType.findUnique({ where: { name: product.name } })
    : null;

  return calculateMaterialEstimate(payload, product, thickness, brickType);
}

module.exports = {
  calculate,
  ensureDefaultCalculatorConfig,
  getCalculatorConfig,
  __private: {
    calculateMaterialEstimate,
    toCalculatorProductDto,
    toThicknessDto,
  },
};
