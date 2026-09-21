const { z } = require('zod');
const { normalizePhone } = require('./quoteValidator');

const optionalText = (max, label) => z.preprocess(
  (value) => value ?? '',
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || null),
);

const optionalPhone = z.preprocess(
  (value) => {
    const normalized = normalizePhone(value);
    return normalized || '';
  },
  z
    .string()
    .regex(/^$|^[6-9]\d{9}$/, 'Phone number must be a valid 10 digit Indian mobile number.')
    .transform((value) => value || null),
);

const amount = (label, allowZero = false) => {
  let schema = z.coerce
    .number({
      required_error: `${label} is required.`,
      invalid_type_error: `${label} must be a number.`,
    })
    .finite(`${label} must be a valid number.`)
    .max(9999999999.99, `${label} is too large.`)
    .multipleOf(0.01, `${label} can have at most two decimal places.`);

  schema = allowZero
    ? schema.min(0, `${label} cannot be negative.`)
    : schema.positive(`${label} must be greater than zero.`);
  return schema;
};

const dateOnly = (label, optional = false) => {
  const schema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD format.`)
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), `${label} is invalid.`);
  return optional
    ? schema.optional().or(z.literal('')).transform((value) => value || null)
    : schema;
};

const offlineSaleSchema = z
  .object({
    customerName: z
      .string({ required_error: 'Customer name is required.' })
      .trim()
      .min(2, 'Customer name must be at least 2 characters.')
      .max(100, 'Customer name must be 100 characters or fewer.'),
    customerPhone: optionalPhone,
    location: optionalText(100, 'Location'),
    product: z
      .string({ required_error: 'Product is required.' })
      .trim()
      .min(2, 'Product is required.')
      .max(100, 'Product must be 100 characters or fewer.'),
    quantity: z.coerce
      .number({
        required_error: 'Quantity is required.',
        invalid_type_error: 'Quantity must be a whole number.',
      })
      .int('Quantity must be a whole number.')
      .positive('Quantity must be greater than zero.')
      .max(100000000, 'Quantity is too large.'),
    unitPrice: z.preprocess(
      (value) => value === '' || value === null || value === undefined ? undefined : value,
      amount('Unit price').optional(),
    ),
    invoicedAmount: amount('Invoiced amount'),
    receivedAmount: amount('Received amount', true),
    saleDate: dateOnly('Sale date'),
    receivedDate: dateOnly('Received date', true),
    paymentMethod: optionalText(50, 'Payment method'),
    notes: optionalText(1000, 'Notes'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.receivedAmount > data.invoicedAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receivedAmount'],
        message: 'Received amount cannot exceed the invoiced amount.',
      });
    }
    if (data.receivedAmount > 0 && !data.receivedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receivedDate'],
        message: 'Received date is required when an amount has been received.',
      });
    }
  });

const expectedUpdatedAt = z
  .string({ required_error: 'The record version is required.' })
  .datetime({ message: 'The record version is invalid.' });

const quoteSaleGridSchema = z.object({
  customerName: z
    .string({ required_error: 'Customer name is required.' })
    .trim()
    .min(2, 'Customer name must be at least 2 characters.')
    .max(100, 'Customer name must be 100 characters or fewer.'),
  customerPhone: z.preprocess(
    normalizePhone,
    z
      .string({ required_error: 'Phone number is required.' })
      .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10 digit Indian mobile number.'),
  ),
  location: z
    .string({ required_error: 'Location is required.' })
    .trim()
    .min(2, 'Location must be at least 2 characters.')
    .max(100, 'Location must be 100 characters or fewer.'),
  product: z
    .string({ required_error: 'Product is required.' })
    .trim()
    .min(2, 'Product is required.')
    .max(100, 'Product must be 100 characters or fewer.'),
  quantity: z.coerce
    .number({
      required_error: 'Quantity is required.',
      invalid_type_error: 'Quantity must be a whole number.',
    })
    .int('Quantity must be a whole number.')
    .positive('Quantity must be greater than zero.')
    .max(100000000, 'Quantity is too large.'),
  invoicedAmount: amount('Invoiced amount'),
}).strict();

const salesGridUpdateSchema = z.object({
  updates: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('QUOTE'),
      id: z.coerce.number().int().positive(),
      expectedUpdatedAt,
      data: quoteSaleGridSchema,
    }).strict(),
    z.object({
      type: z.literal('OFFLINE'),
      id: z.coerce.number().int().positive(),
      expectedUpdatedAt,
      data: offlineSaleSchema,
    }).strict(),
  ])).min(1, 'Change at least one sales record.').max(100, 'Save no more than 100 sales records at once.'),
}).strict();

const analyticsRanges = ['LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'LAST_6_MONTHS', 'THIS_YEAR', 'ALL'];

const analyticsQuerySchema = z.object({
  range: z.enum(analyticsRanges).default('LAST_6_MONTHS'),
}).passthrough();

const salesListQuerySchema = z.object({
  range: z.enum(analyticsRanges).default('LAST_6_MONTHS'),
  type: z.enum(['ALL', 'QUOTE', 'OFFLINE']).default('ALL'),
  status: z.enum(['ALL', 'PAID', 'PARTIAL', 'OUTSTANDING', 'CANCELLED']).default('ALL'),
  search: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).passthrough();

function formatSalesErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  analyticsQuerySchema,
  analyticsRanges,
  formatSalesErrors,
  offlineSaleSchema,
  quoteSaleGridSchema,
  salesGridUpdateSchema,
  salesListQuerySchema,
};
