const crypto = require('crypto');
const { prisma } = require('../config/database');
const { localDateKey, parseDateOnly } = require('../utils/date');
const { isUniqueConstraintError } = require('../utils/prisma');
const productService = require('./productService');

async function nextEnquiryNumber(tx, attempt = 0) {
  const prefix = `SSB-${localDateKey()}-`;
  const latest = await tx.quoteRequest.findFirst({
    where: {
      enquiryNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      enquiryNumber: 'desc',
    },
    select: {
      enquiryNumber: true,
    },
  });

  const latestSequence = latest ? Number(latest.enquiryNumber.slice(prefix.length)) : 0;
  const sequence = latestSequence + 1 + attempt;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function persistQuote(payload, attempt = 0, options = {}) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {
        phone: payload.phone,
      },
      update: {
        name: payload.name,
        email: payload.email,
        location: payload.location,
      },
      create: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        location: payload.location,
      },
    });

    const enquiryNumber = await nextEnquiryNumber(tx, attempt);
    const quote = await tx.quoteRequest.create({
      data: {
        enquiryNumber,
        customerId: customer.id,
        product: payload.product,
        quantity: payload.quantity,
        deliveryDate: parseDateOnly(payload.deliveryDate),
        message: payload.message,
        source: 'WEBSITE',
        priority: 'MEDIUM',
        finalAmount: options.finalAmount,
        paymentToken: options.paymentToken,
        paymentEnabledAt: options.paymentToken ? new Date() : undefined,
        activities: {
          create: {
            type: 'CREATED',
            note: options.activityNote || 'Lead created from website quote request.',
          },
        },
      },
      select: {
        id: true,
        enquiryNumber: true,
        product: true,
        quantity: true,
        deliveryDate: true,
        status: true,
        source: true,
        assignedTo: true,
        pdfUrl: true,
        finalAmount: true,
        paymentToken: true,
        createdAt: true,
      },
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
      },
      quote,
    };
  });
}

async function createQuote(payload) {
  const productExists = await productService.ensureQuoteProductExists(payload.product);
  if (!productExists) {
    const error = new Error('Selected product is not available.');
    error.statusCode = 400;
    error.errors = [
      {
        field: 'product',
        message: 'Select an available product.',
      },
    ];
    throw error;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await persistQuote(payload, attempt);
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Unable to create a unique enquiry number.');
}

async function createRetailPackQuote(payload) {
  const pack = await productService.getRetailPackBySlug(payload.productSlug, payload.quantity);
  if (!pack) {
    const error = new Error('Selected product is not available.');
    error.statusCode = 400;
    error.field = 'productSlug';
    throw error;
  }

  const paymentToken = crypto.randomBytes(24).toString('hex');
  const quotePayload = {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    location: payload.location,
    product: pack.product.name,
    quantity: pack.quantity,
    deliveryDate: payload.deliveryDate,
    message: 'Fixed retail pack checkout.',
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await persistQuote(quotePayload, attempt, {
        activityNote: 'Lead created from website retail pack checkout.',
        finalAmount: pack.totalPrice,
        paymentToken,
      });

      return {
        ...result,
        paymentUrl: `/payment.html?token=${paymentToken}&autostart=1`,
        retailPack: {
          productSlug: pack.product.slug,
          unit: pack.product.unit,
          quantity: pack.quantity,
          totalPrice: Number(pack.totalPrice),
        },
      };
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Unable to create a unique retail order.');
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function getQuoteStats() {
  const today = startOfToday();
  const [todayQuotes, newQuotes] = await Promise.all([
    prisma.quoteRequest.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.quoteRequest.count({
      where: {
        status: 'NEW',
      },
    }),
  ]);

  return {
    todayQuotes,
    newQuotes,
  };
}

async function listRecentQuotes(limit = 25) {
  const quotes = await prisma.quoteRequest.findMany({
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      customer: {
        select: {
          name: true,
          phone: true,
          location: true,
        },
      },
    },
  });

  return quotes.map((quote) => ({
    id: quote.id,
    enquiryNumber: quote.enquiryNumber,
    customerName: quote.customer.name,
    phone: quote.customer.phone,
    location: quote.customer.location,
    product: quote.product,
    quantity: quote.quantity,
    deliveryDate: quote.deliveryDate,
    status: quote.status,
    createdAt: quote.createdAt,
  }));
}

async function getQuoteDocument(enquiryNumber) {
  const quote = await prisma.quoteRequest.findUnique({
    where: {
      enquiryNumber,
    },
    include: {
      document: true,
    },
  });

  if (!quote?.document) {
    const error = new Error('Quotation PDF not found.');
    error.statusCode = 404;
    throw error;
  }

  return quote.document;
}

module.exports = {
  createQuote,
  createRetailPackQuote,
  getQuoteDocument,
  getQuoteStats,
  listRecentQuotes,
};
