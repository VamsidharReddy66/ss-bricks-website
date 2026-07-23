const { z } = require('zod');
const { normalizePhone, normalizeQuantity } = require('./quoteValidator');

const leadSources = [
  'WEBSITE',
  'PHONE',
  'WALK_IN',
  'WHATSAPP',
  'INDIAMART',
  'FACEBOOK',
  'INSTAGRAM',
  'REFERENCE',
  'MANUAL',
  'CSV_IMPORT',
];

const leadStatuses = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'QUOTATION_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'CLOSED',
];

const leadPriorities = ['LOW', 'MEDIUM', 'HIGH'];

function isTodayOrFutureDate(value) {
  if (!value) return true;

  const followUpDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(followUpDate.getTime())) return false;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return followUpDate >= todayUtc;
}

const optionalTrimmed = (max, label) => z.preprocess(
  (value) => value ?? '',
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || null),
);

const optionalEmail = z.preprocess(
  (value) => value ?? '',
  z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255, 'Email must be 255 characters or fewer.')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || null),
);

const followUpDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Next follow-up date must use YYYY-MM-DD format.')
  .refine(isTodayOrFutureDate, 'Next follow-up date cannot be in the past.')
  .optional()
  .or(z.literal(''))
  .transform((value) => value || null);

const leadCreateSchema = z.object({
  name: z
    .string({ required_error: 'Customer name is required.' })
    .trim()
    .min(2, 'Customer name must be at least 2 characters.')
    .max(100, 'Customer name must be 100 characters or fewer.'),
  phone: z.preprocess(
    normalizePhone,
    z
      .string({ required_error: 'Phone number is required.' })
      .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10 digit Indian mobile number.'),
  ),
  email: optionalEmail,
  company: optionalTrimmed(120, 'Company'),
  location: z
    .string({ required_error: 'Location is required.' })
    .trim()
    .min(2, 'Location must be at least 2 characters.')
    .max(100, 'Location must be 100 characters or fewer.'),
  product: z
    .string({ required_error: 'Interested product is required.' })
    .trim()
    .min(2, 'Interested product is required.')
    .max(100, 'Interested product must be 100 characters or fewer.'),
  quantity: z.preprocess(
    normalizeQuantity,
    z
      .number({ required_error: 'Quantity is required.', invalid_type_error: 'Quantity must be zero or more.' })
      .int('Quantity must be a whole number.')
      .min(0, 'Quantity must be zero or more.')
      .max(100000, 'Quantity cannot exceed 100000.'),
  ),
  source: z.enum(leadSources).default('MANUAL'),
  status: z.enum(leadStatuses).default('NEW'),
  priority: z.enum(leadPriorities).default('MEDIUM'),
  notes: optionalTrimmed(1000, 'Notes'),
  assignedTo: optionalTrimmed(100, 'Assigned to'),
  nextFollowUpDate: followUpDateSchema,
}).strict();

const leadUpdateSchema = leadCreateSchema.extend({
  status: z.enum(leadStatuses),
}).strict();

const leadStatusUpdateSchema = z.object({
  status: z.enum(leadStatuses),
  nextFollowUpDate: followUpDateSchema,
  note: optionalTrimmed(1000, 'Note'),
}).strict();

const leadPriorityUpdateSchema = z.object({
  priority: z.enum(leadPriorities),
}).strict();

const leadNotesUpdateSchema = z.object({
  notes: optionalTrimmed(1000, 'Notes'),
}).strict();

const leadActivitySchema = z.object({
  note: z
    .string({ required_error: 'Note is required.' })
    .trim()
    .min(2, 'Note must be at least 2 characters.')
    .max(1000, 'Note must be 1000 characters or fewer.'),
}).strict();

const importRowSchema = leadCreateSchema.extend({
  duplicateAction: z.enum(['SKIP', 'UPDATE_EXISTING', 'IMPORT_ANYWAY']).optional(),
}).strict();

const importCommitSchema = z.object({
  duplicateStrategy: z.enum(['SKIP', 'UPDATE_EXISTING', 'IMPORT_ANYWAY']).default('SKIP'),
  rows: z.array(importRowSchema).min(1, 'At least one lead is required.').max(500, 'Import cannot exceed 500 rows.'),
}).strict();

function formatZodErrors(error) {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  importCommitSchema,
  leadCreateSchema,
  leadPriorities,
  leadSources,
  leadStatuses,
  leadActivitySchema,
  leadNotesUpdateSchema,
  leadPriorityUpdateSchema,
  leadUpdateSchema,
  leadStatusUpdateSchema,
  formatZodErrors,
};
