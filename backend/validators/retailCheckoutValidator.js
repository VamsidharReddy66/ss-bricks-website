const { z } = require('zod');
const {
  normalizePhone,
  normalizeQuantity,
} = require('./quoteValidator');

function isTodayOrFuture(value) {
  const deliveryDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(deliveryDate.getTime())) return false;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return deliveryDate >= todayUtc;
}

const retailCheckoutSchema = z.object({
  productSlug: z
    .string({ required_error: 'Product is required.' })
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Product is invalid.')
    .max(80, 'Product is invalid.'),

  quantity: z.preprocess(
    normalizeQuantity,
    z
      .number({ required_error: 'Pack quantity is required.', invalid_type_error: 'Pack quantity is invalid.' })
      .int('Pack quantity must be a whole number.')
      .positive('Pack quantity must be greater than zero.')
      .max(100000, 'Pack quantity cannot exceed 100000.')
  ),

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

  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(255, 'Email must be 255 characters or fewer.')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || null),

  location: z
    .string({ required_error: 'Location is required.' })
    .trim()
    .min(2, 'Location must be at least 2 characters.')
    .max(100, 'Location must be 100 characters or fewer.'),

  deliveryDate: z
    .string({ required_error: 'Delivery date is required.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date must use YYYY-MM-DD format.')
    .refine(isTodayOrFuture, 'Delivery date cannot be in the past.'),
}).strict();

module.exports = {
  retailCheckoutSchema,
};
