const { z } = require('zod');

const priceInput = z.coerce
  .number({
    required_error: 'Price is required.',
    invalid_type_error: 'Price must be a number.',
  })
  .finite('Price must be a valid number.')
  .positive('Price must be greater than zero.')
  .max(99999999.99, 'Price is too large.');

const productUpdateSchema = z
  .object({
    standardPrice: priceInput,
    bulkPrice: priceInput,
    bulkQuantity: z.coerce
      .number({
        required_error: 'Bulk quantity is required.',
        invalid_type_error: 'Bulk quantity must be a number.',
      })
      .int('Bulk quantity must be a whole number.')
      .positive('Bulk quantity must be greater than zero.')
      .max(100000000, 'Bulk quantity is too large.'),
    availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK'], {
      required_error: 'Availability is required.',
      invalid_type_error: 'Select a valid availability.',
    }),
    description: z
      .string()
      .trim()
      .min(20, 'Description must be at least 20 characters.')
      .max(1000, 'Description must be 1000 characters or fewer.')
      .optional(),
  })
  .refine((data) => data.bulkPrice <= data.standardPrice, {
    field: 'bulkPrice',
    path: ['bulkPrice'],
    message: 'Bulk price must be less than or equal to standard price.',
  });

function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  productUpdateSchema,
  formatZodErrors,
};
