const crypto = require('crypto');
const { prisma } = require('../config/database');
const { localDateKey, parseDateOnly } = require('../utils/date');
const { isUniqueConstraintError } = require('../utils/prisma');
const productService = require('./productService');
const { calculateQuotation } = require('./quotationPricingService');
const { generateAndStoreQuotePdf } = require('./pdfService');

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
        productId: options.pricing.productId,
        quantity: payload.quantity,
        quotedUnitPrice: options.pricing.unitPrice,
        lineAmount: options.pricing.lineAmount,
        subtotal: options.pricing.subtotal,
        cgstRate: options.pricing.cgstRate,
        cgstAmount: options.pricing.cgstAmount,
        sgstRate: options.pricing.sgstRate,
        sgstAmount: options.pricing.sgstAmount,
        igstRate: options.pricing.igstRate,
        igstAmount: options.pricing.igstAmount,
        grandTotal: options.pricing.grandTotal,
        amountInWords: options.pricing.amountInWords,
        deliveryDate: parseDateOnly(payload.deliveryDate),
        message: payload.message,
        source: 'WEBSITE',
        priority: 'MEDIUM',
        finalAmount: options.finalAmount || options.pricing.grandTotal,
        paymentToken: options.paymentToken,
        paymentEnabledAt: options.paymentToken ? new Date() : undefined,
        idempotencyKey: options.idempotencyKey,
        requestFingerprint: options.requestFingerprint,
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
        productId: true,
        quotedUnitPrice: true,
        lineAmount: true,
        subtotal: true,
        cgstRate: true,
        cgstAmount: true,
        sgstRate: true,
        sgstAmount: true,
        igstRate: true,
        igstAmount: true,
        grandTotal: true,
        amountInWords: true,
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

function quoteFingerprint(payload) {
  const canonical = Object.keys(payload).sort().reduce((result, key) => {
    result[key] = payload[key] ?? null;
    return result;
  }, {});
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function findIdempotentQuote(idempotencyKey) {
  if (!idempotencyKey) return null;
  const quote = await prisma.quoteRequest.findUnique({
    where: { idempotencyKey },
    include: { customer: true },
  });
  return quote ? { customer: quote.customer, quote } : null;
}

async function createQuote(payload, { idempotencyKey = null } = {}) {
  const requestFingerprint = idempotencyKey ? quoteFingerprint(payload) : null;
  const existing = await findIdempotentQuote(idempotencyKey);
  if (existing) {
    if (existing.quote.requestFingerprint !== requestFingerprint) {
      const error = new Error('Idempotency key was already used for a different quotation request.');
      error.statusCode = 409;
      throw error;
    }
    return { ...existing, reused: true };
  }

  const product = await productService.getQuoteProductPricing(payload.product);
  if (!product) {
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
  const pricing = calculateQuotation(product, payload.quantity);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await persistQuote(payload, attempt, { pricing, idempotencyKey, requestFingerprint });
    } catch (error) {
      if (idempotencyKey && isUniqueConstraintError(error)) {
        const concurrent = await findIdempotentQuote(idempotencyKey);
        if (concurrent) {
          if (concurrent.quote.requestFingerprint !== requestFingerprint) {
            const conflict = new Error('Idempotency key was already used for a different quotation request.');
            conflict.statusCode = 409;
            throw conflict;
          }
          return { ...concurrent, reused: true };
        }
      }
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
  const pricing = calculateQuotation(pack.product, pack.quantity, { forceStandardPrice: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await persistQuote(quotePayload, attempt, {
        activityNote: 'Lead created from website retail pack checkout.',
        finalAmount: pack.totalPrice,
        paymentToken,
        pricing,
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

async function regenerateQuotePdf(quoteId, adminId) {
  const id = Number(quoteId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }
  const quote = await prisma.quoteRequest.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!quote) {
    const error = new Error('Quotation not found.');
    error.statusCode = 404;
    throw error;
  }
  if (quote.quotedUnitPrice === null || quote.lineAmount === null || quote.grandTotal === null) {
    const error = new Error('This lead has no stored quotation price snapshot.');
    error.statusCode = 409;
    throw error;
  }

  const pdf = await generateAndStoreQuotePdf({ customer: quote.customer, quote });
  await prisma.leadActivity.create({
    data: {
      leadId: quote.id,
      type: 'NOTE',
      note: `Quotation PDF regenerated from stored price snapshot: ${pdf.fileName}.`,
      createdBy: adminId,
    },
  });
  return pdf;
}

module.exports = {
  createQuote,
  createRetailPackQuote,
  getQuoteDocument,
  getQuoteStats,
  listRecentQuotes,
  regenerateQuotePdf,
  quoteFingerprint,
};
