const { z } = require('zod');

const nullableText = (max) => z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().max(max).nullable(),
);
const requiredText = (max) => z.string().trim().min(1).max(max);
const nullableNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().finite().nullable(),
);
const nonNegativeNumber = z.preprocess(
  (value) => Number(value),
  z.number().finite().nonnegative(),
);
const nullableNonNegativeNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().finite().nonnegative().nullable(),
);
const dateText = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.');
const nullableDateText = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : value),
  dateText.nullable(),
);

const saleSchema = z.object({
  saleDate: dateText,
  customerName: requiredText(160),
  customerPhone: nullableText(20),
  location: nullableText(200),
  productName: nullableText(160),
  quantity: nullableNonNegativeNumber,
  quantityUnit: z.string().trim().min(1).max(30).default('load'),
  unitPrice: nullableNonNegativeNumber,
  driverBatta: nullableNonNegativeNumber,
  invoicedAmount: nonNegativeNumber,
  paymentMethod: nullableText(80),
  receivedTo: nullableText(160),
  notes: nullableText(2000),
});

const receiptSchema = z.object({
  receiptDate: dateText,
  saleId: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().nullable(),
  ),
  customerName: nullableText(160),
  amount: nonNegativeNumber.refine((value) => value > 0, 'Amount must be greater than zero.'),
  paymentMethod: nullableText(80),
  receivedTo: nullableText(160),
  reference: nullableText(255),
  notes: nullableText(2000),
}).superRefine((value, context) => {
  if (!value.saleId && !value.customerName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['saleId'], message: 'Enter a ledger sale ID or customer name.' });
  }
});

const expenseSchema = z.object({
  expenseDate: dateText,
  category: requiredText(80).default('UNCATEGORIZED'),
  description: nullableText(500),
  amount: nonNegativeNumber.refine((value) => value > 0, 'Amount must be greater than zero.'),
  paymentMethod: nullableText(80),
  paidBy: nullableText(160),
  notes: nullableText(2000),
});

const purchaseSchema = z.object({
  purchaseDate: dateText,
  materialName: requiredText(120),
  unitPrice: nullableNonNegativeNumber,
  quantity: nullableNonNegativeNumber,
  purchaseAmount: nonNegativeNumber.refine((value) => value > 0, 'Amount must be greater than zero.'),
  driverBatta: nonNegativeNumber.default(0),
  vendorName: nullableText(160),
  paidDate: nullableDateText,
  paymentStatus: z.enum(['PAID', 'PENDING', 'UNKNOWN']).default('UNKNOWN'),
  paymentMethod: nullableText(80),
  paidBy: nullableText(160),
  notes: nullableText(2000),
});

const productionSchema = z.object({
  recordDate: dateText,
  recordType: z.enum(['PRODUCTION', 'NO_PRODUCTION', 'SUNDAY', 'UNKNOWN']),
  productName: nullableText(160),
  quantity: nullableNonNegativeNumber,
  reason: nullableText(500),
  qualityNote: nullableText(1000),
}).superRefine((value, context) => {
  if (value.recordType === 'PRODUCTION' && (!value.quantity || value.quantity <= 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Production quantity must be greater than zero.' });
  }
  if (value.recordType === 'NO_PRODUCTION' && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Record the reason for no production.' });
  }
});

const labourSchema = z.object({
  paymentDate: dateText,
  workDescription: requiredText(500),
  quantity: nullableNonNegativeNumber,
  rawQuantity: nullableText(255),
  brickMakingAmount: nullableNonNegativeNumber,
  otherPaymentNote: nullableText(1000),
  totalAmount: nonNegativeNumber.refine((value) => value > 0, 'Amount must be greater than zero.'),
  pendingAmount: nullableNonNegativeNumber,
  paymentMethod: nullableText(80),
  paidBy: nullableText(160),
  notes: nullableText(2000),
});

const eventSchema = z.object({
  occurredAt: z.string().trim().min(1).transform((value, context) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid event date and time.' });
      return z.NEVER;
    }
    return date;
  }),
  type: z.enum([
    'CUSTOMER_ISSUE',
    'MACHINE_PROBLEM',
    'STOCK_ISSUE',
    'VENDOR_ISSUE',
    'RECEIVABLE_FOLLOW_UP',
    'LARGE_ORDER',
    'CORRECTION',
    'OPERATIONAL_OBSERVATION',
    'BUSINESS_NOTE',
  ]),
  category: nullableText(100),
  description: requiredText(2000),
  relatedEntityType: nullableText(50),
  relatedEntityId: nullableText(80),
  amount: nullableNumber,
  impact: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).default('NEUTRAL'),
  status: z.enum(['OPEN', 'RESOLVED', 'ARCHIVED']).default('OPEN'),
});

const recordSchemas = {
  sales: saleSchema,
  receipts: receiptSchema,
  expenses: expenseSchema,
  purchases: purchaseSchema,
  production: productionSchema,
  labour: labourSchema,
  events: eventSchema,
};

const listBusinessRecordsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(''),
  state: z.enum(['ACTIVE', 'VOIDED', 'ALL']).default('ACTIVE'),
  origin: z.enum(['XLSX_IMPORT', 'MANUAL', 'ALL']).default('ALL'),
  range: z.enum(['LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'LAST_6_MONTHS', 'THIS_YEAR', 'ALL']).default('ALL'),
  month: z.union([z.literal('ALL'), z.string().regex(/^\d{4}-\d{2}$/, 'Month must use YYYY-MM format.')]).default('ALL'),
});

const recordTypeSchema = z.enum(Object.keys(recordSchemas));
const recordIdSchema = z.coerce.number().int().positive();
const recordCorrectionSchema = z.object({
  data: z.record(z.unknown()),
  reason: z.string().trim().min(3).max(500),
});
const voidRecordSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

function formatBusinessErrors(error) {
  return error.errors.map((item) => ({
    field: item.path.join('.') || 'record',
    message: item.message,
  }));
}

module.exports = {
  formatBusinessErrors,
  listBusinessRecordsSchema,
  recordCorrectionSchema,
  recordIdSchema,
  recordSchemas,
  recordTypeSchema,
  voidRecordSchema,
};
