const crypto = require('crypto');
const env = require('../config/env');
const { createRazorpayClient, requireRazorpayConfig } = require('../config/razorpay');
const { PaymentRepository } = require('./paymentRepository');
const { paymentDto, publicQuotationDto } = require('./paymentDto');
const { createPaymentReceipt } = require('./paymentReceiptService');
const { verifyPaymentSignature } = require('./paymentVerificationService');

function clientError(message, statusCode = 400, field = 'payment') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.field = field;
  return error;
}

function amountToPaise(amount) {
  const paise = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw clientError('The configured quotation amount is invalid.', 400, 'finalAmount');
  }
  return paise;
}

function safeFailureReason(value) {
  return String(value || 'Payment was not completed.').replace(/\s+/g, ' ').trim().slice(0, 500);
}

class PaymentService {
  constructor({
    repository = new PaymentRepository(),
    razorpayClientFactory = createRazorpayClient,
    ensureConfigured = requireRazorpayConfig,
    keyId = env.razorpay.keyId,
    secret = env.razorpay.secret,
  } = {}) {
    this.repository = repository;
    this.razorpayClientFactory = razorpayClientFactory;
    this.ensureConfigured = ensureConfigured;
    this.keyId = keyId;
    this.secret = secret;
  }

  async configureQuotation(quotationId, payload, adminId) {
    const id = Number(quotationId);
    if (!Number.isInteger(id) || id <= 0) {
      throw clientError('Lead not found.', 404, 'lead');
    }

    const quotation = await this.repository.findQuotationForAdmin(id);
    if (!quotation) throw clientError('Lead not found.', 404, 'lead');

    const nextAmount = Number(payload.finalAmount);
    const successfulPayment = quotation.payments.find((payment) => payment.status === 'SUCCESS');
    const amountChanged = quotation.finalAmount === null
      || Number(quotation.finalAmount) !== nextAmount;

    if (successfulPayment && amountChanged) {
      throw clientError('The final amount cannot be changed after a successful payment.', 409, 'finalAmount');
    }

    const paymentToken = quotation.paymentToken || crypto.randomBytes(24).toString('hex');
    await this.repository.client.$transaction(async (tx) => {
      await tx.quoteRequest.update({
        where: { id },
        data: {
          finalAmount: nextAmount,
          paymentToken,
          paymentEnabledAt: quotation.paymentEnabledAt || new Date(),
        },
      });

      if (amountChanged) {
        await tx.payment.updateMany({
          where: { quotationId: id, status: 'PENDING' },
          data: {
            status: 'FAILED',
            failureReason: 'Quotation amount was updated before payment completion.',
          },
        });
      }

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'NOTE',
          note: `Payment amount configured: INR ${nextAmount.toFixed(2)}.`,
          createdBy: adminId,
        },
      });
    });

    return {
      quotationId: id,
      finalAmount: nextAmount,
      paymentUrl: `/payment.html?token=${paymentToken}`,
    };
  }

  async getPublicQuotation(paymentToken) {
    const quotation = await this.repository.findQuotationByToken(paymentToken);
    if (!quotation || quotation.finalAmount === null) {
      throw clientError('Payment link is invalid or has not been enabled.', 404, 'paymentToken');
    }
    return publicQuotationDto(quotation);
  }

  async createOrder({ paymentToken }) {
    this.ensureConfigured();
    const quotation = await this.repository.findQuotationByToken(paymentToken);
    if (!quotation || quotation.finalAmount === null) {
      throw clientError('Payment link is invalid or has not been enabled.', 404, 'paymentToken');
    }
    if (quotation.payments.some((payment) => payment.status === 'SUCCESS')) {
      throw clientError('This quotation has already been paid.', 409, 'payment');
    }

    const amount = amountToPaise(quotation.finalAmount);
    const currency = 'INR';
    const razorpay = this.razorpayClientFactory();
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: quotation.enquiryNumber.slice(0, 40),
      notes: {
        quotation_id: String(quotation.id),
        enquiry_number: quotation.enquiryNumber,
      },
    });

    if (!order?.id || Number(order.amount) !== amount || order.currency !== currency) {
      throw new Error('Razorpay returned an invalid order response.');
    }

    const payment = await this.repository.createPendingPayment({
      quotationId: quotation.id,
      customerName: quotation.customer.name,
      customerPhone: quotation.customer.phone,
      customerEmail: quotation.customer.email,
      razorpayOrderId: order.id,
      amount: Number(quotation.finalAmount),
      currency,
      status: 'PENDING',
    });

    return {
      keyId: this.keyId,
      orderId: payment.razorpayOrderId,
      amount,
      currency,
      quotationNumber: quotation.enquiryNumber,
      customer: {
        name: quotation.customer.name,
        phone: quotation.customer.phone,
        email: quotation.customer.email,
      },
    };
  }

  async verifyPayment(payload) {
    this.ensureConfigured();
    const payment = await this.repository.findPaymentByOrderId(payload.razorpay_order_id);
    if (!payment || payment.quotation.paymentToken !== payload.paymentToken) {
      throw clientError('Payment order was not found.', 404, 'razorpay_order_id');
    }

    if (payment.status === 'SUCCESS') {
      if (payment.razorpayPaymentId !== payload.razorpay_payment_id) {
        throw clientError('Payment order has already been completed.', 409, 'payment');
      }
      return paymentDto(payment);
    }

    const signatureValid = verifyPaymentSignature({
      orderId: payload.razorpay_order_id,
      paymentId: payload.razorpay_payment_id,
      signature: payload.razorpay_signature,
      secret: this.secret,
    });
    if (!signatureValid) {
      throw clientError('Payment signature verification failed.', 400, 'razorpay_signature');
    }

    const razorpay = this.razorpayClientFactory();
    const fetched = await razorpay.payments.fetch(payload.razorpay_payment_id);
    const expectedPaise = amountToPaise(payment.amount);
    if (
      fetched?.order_id !== payment.razorpayOrderId
      || Number(fetched.amount) !== expectedPaise
      || fetched.currency !== payment.currency
    ) {
      throw clientError('Razorpay payment details do not match this quotation.', 400, 'payment');
    }

    const nextStatus = fetched.status === 'captured'
      ? 'SUCCESS'
      : fetched.status === 'failed' ? 'FAILED' : 'PENDING';
    const receiptUrl = nextStatus === 'SUCCESS'
      ? `/api/payment/quote/${payload.paymentToken}/receipt`
      : null;
    const updatedAt = new Date();
    const paymentData = {
      ...payment,
      razorpayPaymentId: fetched.id,
      razorpaySignature: payload.razorpay_signature,
      paymentMethod: fetched.method || null,
      status: nextStatus,
      failureReason: nextStatus === 'FAILED' ? safeFailureReason(fetched.error_description) : null,
      receiptUrl,
      updatedAt,
    };
    const receipt = nextStatus === 'SUCCESS'
      ? createPaymentReceipt({ payment: paymentData, quotation: payment.quotation })
      : null;

    const updated = await this.repository.client.$transaction(async (tx) => {
      const saved = await tx.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId: fetched.id,
          razorpaySignature: payload.razorpay_signature,
          paymentMethod: fetched.method || null,
          status: nextStatus,
          failureReason: paymentData.failureReason,
          receiptUrl,
        },
        include: {
          quotation: {
            select: {
              id: true,
              enquiryNumber: true,
              paymentToken: true,
              finalAmount: true,
            },
          },
          receipt: true,
        },
      });

      if (receipt) {
        await tx.paymentReceipt.upsert({
          where: { paymentId: payment.id },
          update: {
            fileName: `receipt-${payment.quotation.enquiryNumber}.pdf`,
            contentType: 'application/pdf',
            content: receipt,
          },
          create: {
            paymentId: payment.id,
            fileName: `receipt-${payment.quotation.enquiryNumber}.pdf`,
            contentType: 'application/pdf',
            content: receipt,
          },
        });
        await tx.leadActivity.create({
          data: {
            leadId: payment.quotationId,
            type: 'NOTE',
            note: `Test payment successful. Payment ID: ${fetched.id}.`,
          },
        });
      }
      return saved;
    });

    return paymentDto(updated);
  }

  async recordFailure(payload) {
    const payment = await this.repository.findPaymentByOrderId(payload.razorpay_order_id);
    if (!payment || payment.quotation.paymentToken !== payload.paymentToken) {
      throw clientError('Payment order was not found.', 404, 'razorpay_order_id');
    }
    if (payment.status === 'SUCCESS') return paymentDto(payment);

    const updated = await this.repository.client.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: safeFailureReason(payload.reason),
      },
      include: {
        quotation: {
          select: {
            id: true,
            enquiryNumber: true,
            paymentToken: true,
            finalAmount: true,
          },
        },
        receipt: true,
      },
    });
    return paymentDto(updated);
  }

  async getReceipt(paymentToken) {
    const receipt = await this.repository.findSuccessfulReceipt(paymentToken);
    if (!receipt) throw clientError('Payment receipt not found.', 404, 'receipt');
    return receipt;
  }

  async listPayments() {
    const payments = await this.repository.listPayments();
    return payments.map(paymentDto);
  }
}

const paymentService = new PaymentService();

module.exports = {
  PaymentService,
  amountToPaise,
  paymentService,
};
