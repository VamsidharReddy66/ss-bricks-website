const { z } = require('zod');

const positiveMeasurement = (label) => z.coerce
  .number({
    required_error: `${label} is required.`,
    invalid_type_error: `${label} must be a number.`,
  })
  .finite(`${label} must be a valid number.`)
  .positive(`${label} must be greater than zero.`)
  .max(10000, `${label} is too large.`);

const positiveId = (label) => z.coerce
  .number({
    required_error: `${label} is required.`,
    invalid_type_error: `${label} is required.`,
  })
  .int(`${label} is invalid.`)
  .positive(`${label} is required.`);

const brickQuantity = z.coerce
  .number({
    required_error: 'Quantity is required.',
    invalid_type_error: 'Quantity must be a number.',
  })
  .finite('Quantity must be a valid number.')
  .int('Quantity must be a whole number of bricks.')
  .positive('Quantity must be greater than zero.')
  .max(100000000, 'Quantity is too large.');

const wallUnit = z.enum(['ft', 'm'], {
  required_error: 'Unit is required.',
  invalid_type_error: 'Select feet or meters.',
});

const calculatorRequestSchema = z.object({
  height: positiveMeasurement('Height'),
  heightUnit: wallUnit,
  width: positiveMeasurement('Width'),
  widthUnit: wallUnit,
  thicknessId: positiveId('Wall thickness'),
  productId: positiveId('Product type'),
  quantity: brickQuantity,
}).strict();

function formatCalculatorErrors(error) {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  calculatorRequestSchema,
  formatCalculatorErrors,
};
