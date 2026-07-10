const { z } = require('zod');

function normalizePhone(value) {
  if (typeof value !== 'string') return value;

  let phone = value.replace(/[\s-]/g, '').trim();
  if (phone.startsWith('+91')) phone = phone.slice(3);
  if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
  return phone;
}

function normalizeQuantity(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return 0;
  if (!/^\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

function isTodayOrFuture(value) {
  const deliveryDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(deliveryDate.getTime())) return false;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return deliveryDate >= todayUtc;
}

const quoteRequestSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be 100 characters or fewer.')
    .regex(/^[A-Za-z ]+$/, 'Name can contain alphabets and spaces only.')
    .refine((value) => !/\s{2,}/.test(value), 'Name cannot contain consecutive spaces.'),

  phone: z.preprocess(
    normalizePhone,
    z
      .string({ required_error: 'Phone number is required.' })
      .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10 digit Indian mobile number.')
  ),

  location: z
    .string({ required_error: 'Location is required.' })
    .trim()
    .min(2, 'Location must be at least 2 characters.')
    .max(100, 'Location must be 100 characters or fewer.'),

  product: z
    .string({ required_error: 'Product is required.', invalid_type_error: 'Product is required.' })
    .trim()
    .min(2, 'Product is required.')
    .max(100, 'Product must be 100 characters or fewer.'),

  quantity: z.preprocess(
    normalizeQuantity,
    z
      .number({ required_error: 'Quantity is required.', invalid_type_error: 'Quantity must be zero or more.' })
      .int('Quantity must be a whole number.')
      .min(0, 'Quantity must be zero or more.')
      .max(100000, 'Quantity cannot exceed 100000.')
  ),

  deliveryDate: z
    .string({ required_error: 'Delivery date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date must use YYYY-MM-DD format.')
    .refine(isTodayOrFuture, 'Delivery date cannot be in the past.'),

  message: z
    .string()
    .trim()
    .max(500, 'Message must be 500 characters or fewer.')
    .optional()
    .transform((value) => value || null),
}).strict();

function formatZodErrors(error) {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  quoteRequestSchema,
  formatZodErrors,
  normalizePhone,
  normalizeQuantity,
};
