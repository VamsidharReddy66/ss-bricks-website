const env = require('../config/env');
const { paymentService } = require('../services/paymentService');
const quoteService = require('../services/quoteService');
const { prepareQuoteDistribution } = require('./quoteController');
const { verifyWebhookSignature } = require('../services/paymentVerificationService');
const { retailCheckoutSchema } = require('../validators/retailCheckoutValidator');
const {
  configurePaymentSchema,
  createOrderSchema,
  formatPaymentErrors,
  paymentFailureSchema,
  paymentToken,
  verifyPaymentSchema,
} = require('../validators/paymentValidator');
const { successResponse, errorResponse } = require('../utils/apiResponse');

function validationFailure(res, error) {
  return errorResponse(res, 400, 'Validation failed.', formatPaymentErrors(error));
}

async function getQuotation(req, res, next) {
  try {
    const parsed = paymentToken.safeParse(req.params.token);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const quotation = await paymentService.getPublicQuotation(parsed.data);
    return successResponse(res, 200, 'Payment quotation fetched successfully.', { quotation });
  } catch (error) {
    return next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const order = await paymentService.createOrder(parsed.data);
    return successResponse(res, 201, 'Razorpay test order created successfully.', { order });
  } catch (error) {
    return next(error);
  }
}

async function createRetailCheckout(req, res, next) {
  try {
    const parsed = retailCheckoutSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);

    const result = await quoteService.createRetailPackQuote(parsed.data);
    await prepareQuoteDistribution(result);

    return successResponse(res, 201, 'Retail pack checkout created successfully.', {
      checkout: {
        enquiryNumber: result.quote.enquiryNumber,
        paymentUrl: result.paymentUrl,
        product: result.quote.product,
        quantity: result.retailPack.quantity,
        unit: result.retailPack.unit,
        totalPrice: result.retailPack.totalPrice,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const payment = await paymentService.verifyPayment(parsed.data);
    const message = payment.status === 'SUCCESS'
      ? 'Payment successful.'
      : 'Payment verified and is awaiting capture.';
    return successResponse(res, 200, message, { payment });
  } catch (error) {
    return next(error);
  }
}

async function recordFailure(req, res, next) {
  try {
    const parsed = paymentFailureSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const payment = await paymentService.recordFailure(parsed.data);
    return successResponse(res, 200, 'Payment failure recorded.', { payment });
  } catch (error) {
    return next(error);
  }
}

async function getReceipt(req, res, next) {
  try {
    const parsed = paymentToken.safeParse(req.params.token);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const receipt = await paymentService.getReceipt(parsed.data);
    res.setHeader('Content-Type', receipt.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(Buffer.from(receipt.content));
  } catch (error) {
    return next(error);
  }
}

async function configureQuotation(req, res, next) {
  try {
    const parsed = configurePaymentSchema.safeParse(req.body);
    if (!parsed.success) return validationFailure(res, parsed.error);
    const payment = await paymentService.configureQuotation(req.params.id, parsed.data, req.admin.id);
    return successResponse(res, 200, 'Quotation payment amount configured.', { payment });
  } catch (error) {
    return next(error);
  }
}

async function listPayments(_req, res, next) {
  try {
    const payments = await paymentService.listPayments();
    return successResponse(res, 200, 'Payments fetched successfully.', { payments });
  } catch (error) {
    return next(error);
  }
}

function webhook(req, res, next) {
  try {
    if (!env.razorpay.webhookSecret) {
      const error = new Error('Razorpay webhook is not configured.');
      error.statusCode = 503;
      error.field = 'webhook';
      throw error;
    }
    const signature = req.get('x-razorpay-signature') || '';
    const valid = verifyWebhookSignature({
      rawBody: req.body,
      signature,
      secret: env.razorpay.webhookSecret,
    });
    if (!valid) {
      return errorResponse(res, 400, 'Webhook signature verification failed.', [
        { field: 'signature', message: 'Webhook signature is invalid.' },
      ]);
    }

    const event = JSON.parse(req.body.toString('utf8'));
    // Future webhook business handling belongs here. Keep this endpoint verification-only
    // until idempotent event persistence and event-specific reconciliation are implemented.
    console.info('Verified Razorpay webhook event.', {
      event: event.event || 'unknown',
      eventId: req.get('x-razorpay-event-id') || null,
    });
    return successResponse(res, 200, 'Webhook verified.', {});
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  configureQuotation,
  createOrder,
  createRetailCheckout,
  getQuotation,
  getReceipt,
  listPayments,
  recordFailure,
  verify,
  webhook,
};
