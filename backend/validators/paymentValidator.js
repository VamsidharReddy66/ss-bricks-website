const { z } = require('zod');

const paymentToken = z
  .string({ required_error: 'Payment token is required.' })
  .trim()
  .regex(/^[a-f0-9]{48}$/, 'Payment link is invalid.');

const razorpayId = (label, prefix) => z
  .string({ required_error: `${label} is required.` })
  .trim()
  .regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`), `${label} is invalid.`)
  .max(100, `${label} is too long.`);

const finalAmount = z.preprocess(
  (value) => (typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : value),
  z
    .number({ required_error: 'Final amount is required.', invalid_type_error: 'Final amount must be a number.' })
    .finite('Final amount must be valid.')
    .positive('Final amount must be greater than zero.')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Final amount can have at most two decimal places.'),
);

const configurePaymentSchema = z.object({
  finalAmount,
}).strict();

const createOrderSchema = z.object({
  paymentToken,
}).strict();

const verifyPaymentSchema = z.object({
  paymentToken,
  razorpay_order_id: razorpayId('Razorpay order ID', 'order'),
  razorpay_payment_id: razorpayId('Razorpay payment ID', 'pay'),
  razorpay_signature: z
    .string({ required_error: 'Razorpay signature is required.' })
    .trim()
    .regex(/^[a-f0-9]{64}$/i, 'Razorpay signature is invalid.'),
}).strict();

const paymentFailureSchema = z.object({
  paymentToken,
  razorpay_order_id: razorpayId('Razorpay order ID', 'order'),
  razorpay_payment_id: razorpayId('Razorpay payment ID', 'pay').optional().nullable(),
  reason: z.string().trim().max(500, 'Failure reason is too long.').optional().nullable(),
}).strict();

function formatPaymentErrors(error) {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

module.exports = {
  configurePaymentSchema,
  createOrderSchema,
  formatPaymentErrors,
  paymentFailureSchema,
  paymentToken,
  verifyPaymentSchema,
};
