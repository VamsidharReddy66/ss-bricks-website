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

async function persistQuote(payload, attempt = 0) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {
        phone: payload.phone,
      },
      update: {
        name: payload.name,
        location: payload.location,
      },
      create: {
        name: payload.name,
        phone: payload.phone,
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
        activities: {
          create: {
            type: 'CREATED',
            note: 'Lead created from website quote request.',
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
        createdAt: true,
      },
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
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
  getQuoteDocument,
  getQuoteStats,
  listRecentQuotes,
};
