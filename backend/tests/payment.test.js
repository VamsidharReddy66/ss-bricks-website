const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  configurePaymentSchema,
  createOrderSchema,
  verifyPaymentSchema,
} = require('../validators/paymentValidator');
const {
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../services/paymentVerificationService');
const { createPaymentReceipt } = require('../services/paymentReceiptService');
const { PaymentService, amountToPaise } = require('../services/paymentService');

const token = 'a'.repeat(48);

test('accepts an admin-confirmed amount and secure payment token', () => {
  assert.equal(configurePaymentSchema.parse({ finalAmount: '12,500.50' }).finalAmount, 12500.5);
  assert.equal(createOrderSchema.parse({ paymentToken: token }).paymentToken, token);
});

test('rejects invalid amounts and browser-supplied order fields', () => {
  assert.equal(configurePaymentSchema.safeParse({ finalAmount: 0 }).success, false);
  assert.equal(configurePaymentSchema.safeParse({ finalAmount: 10.999 }).success, false);
  assert.equal(createOrderSchema.safeParse({ paymentToken: token, amount: 1 }).success, false);
});

test('validates Razorpay callback identifiers and signature shape', () => {
  const parsed = verifyPaymentSchema.parse({
    paymentToken: token,
    razorpay_order_id: 'order_test123',
    razorpay_payment_id: 'pay_test123',
    razorpay_signature: 'b'.repeat(64),
  });
  assert.equal(parsed.razorpay_order_id, 'order_test123');
});

test('verifies payment signatures with HMAC SHA-256', () => {
  const secret = 'test_secret';
  const orderId = 'order_123';
  const paymentId = 'pay_123';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature, secret }), true);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: '0'.repeat(64), secret }), false);
});

test('verifies webhook signatures against the unparsed request body', () => {
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const secret = 'webhook_secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyWebhookSignature({ rawBody, signature, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: JSON.parse(rawBody), signature, secret }), false);
});

test('converts quotation rupees to integer paise', () => {
  assert.equal(amountToPaise(12500.5), 1250050);
  assert.throws(() => amountToPaise(0), /invalid/);
});

test('creates Razorpay order using only the stored quotation amount', async () => {
  const quotation = {
    id: 42,
    enquiryNumber: 'SSB-20260718-0001',
    finalAmount: 12500.5,
    customer: {
      name: 'Test Customer',
      phone: '9000000000',
      email: 'test@example.com',
    },
    payments: [],
  };
  let orderRequest;
  let storedPayment;
  const repository = {
    findQuotationByToken: async () => quotation,
    createPendingPayment: async (data) => {
      storedPayment = data;
      return {
        id: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        quotation: {
          id: quotation.id,
          enquiryNumber: quotation.enquiryNumber,
          paymentToken: token,
          finalAmount: quotation.finalAmount,
        },
        receipt: null,
      };
    },
  };
  const service = new PaymentService({
    repository,
    keyId: 'rzp_test_public',
    secret: 'test_secret',
    ensureConfigured: () => {},
    razorpayClientFactory: () => ({
      orders: {
        create: async (request) => {
          orderRequest = request;
          return { id: 'order_created123', amount: request.amount, currency: request.currency };
        },
      },
    }),
  });

  const result = await service.createOrder({ paymentToken: token, amount: 1 });
  assert.equal(orderRequest.amount, 1250050);
  assert.equal(storedPayment.amount, 12500.5);
  assert.equal(result.amount, 1250050);
  assert.equal(result.keyId, 'rzp_test_public');
});

test('generates a database-storable PDF receipt', () => {
  const content = createPaymentReceipt({
    quotation: { enquiryNumber: 'SSB-20260718-0001' },
    payment: {
      customerName: 'Test Customer',
      customerPhone: '9000000000',
      amount: 12500.5,
      currency: 'INR',
      paymentMethod: 'upi',
      razorpayPaymentId: 'pay_test123',
      razorpayOrderId: 'order_test123',
      status: 'SUCCESS',
      updatedAt: new Date('2026-07-18T10:00:00.000Z'),
    },
  });

  assert.equal(Buffer.isBuffer(content), true);
  assert.equal(content.subarray(0, 8).toString('latin1').startsWith('%PDF-1.4'), true);
  assert.ok(content.length > 1000);
});
