const { prisma } = require('../config/database');

const paymentInclude = {
  quotation: {
    select: {
      id: true,
      enquiryNumber: true,
      paymentToken: true,
      finalAmount: true,
    },
  },
  receipt: true,
};

class PaymentRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findQuotationByToken(paymentToken) {
    return this.client.quoteRequest.findUnique({
      where: { paymentToken },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { receipt: true },
        },
      },
    });
  }

  findQuotationForAdmin(quotationId) {
    return this.client.quoteRequest.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  createPendingPayment(data) {
    return this.client.payment.create({
      data,
      include: paymentInclude,
    });
  }

  findPaymentByOrderId(orderId) {
    return this.client.payment.findUnique({
      where: { razorpayOrderId: orderId },
      include: paymentInclude,
    });
  }

  async findSuccessfulReceipt(paymentToken) {
    const quotation = await this.client.quoteRequest.findUnique({
      where: { paymentToken },
      select: {
        payments: {
          where: { status: 'SUCCESS' },
          take: 1,
          orderBy: { updatedAt: 'desc' },
          include: { receipt: true },
        },
      },
    });
    return quotation?.payments?.[0]?.receipt || null;
  }

  listPayments(limit = 100) {
    return this.client.payment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: paymentInclude,
    });
  }
}

module.exports = {
  PaymentRepository,
  paymentInclude,
};
