const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../config/database');
const productService = require('../services/productService');
const quoteService = require('../services/quoteService');

const payload = { name: 'Ravi Kumar', phone: '9876543210', email: null, location: 'Nellore', product: 'Fly Ash Bricks', quantity: 100, deliveryDate: '2026-12-01', message: null };
const pricing = { id: 1, name: 'Fly Ash Bricks', standardPrice: '8', bulkPrice: '7', bulkQuantity: 1000, unit: 'brick' };

function installHarness() {
  const originals = { transaction: prisma.$transaction, findUnique: prisma.quoteRequest.findUnique, pricing: productService.getQuoteProductPricing };
  const quotes = [];
  productService.getQuoteProductPricing = async () => pricing;
  prisma.quoteRequest.findUnique = async ({ where }) => {
    const quote = quotes.find((item) => item.idempotencyKey === where.idempotencyKey);
    return quote ? { ...quote, customer: quote.customer } : null;
  };
  prisma.$transaction = async (callback) => callback({
    customer: { upsert: async () => ({ id: 1, name: payload.name, phone: payload.phone, email: null, location: payload.location }) },
    quoteRequest: {
      findFirst: async () => quotes.length ? { enquiryNumber: quotes.at(-1).enquiryNumber } : null,
      create: async ({ data }) => {
        if (data.idempotencyKey && quotes.some((item) => item.idempotencyKey === data.idempotencyKey)) { const error = new Error('duplicate'); error.code = 'P2002'; throw error; }
        const quote = { id: quotes.length + 1, enquiryNumber: `SSB-TEST-${quotes.length + 1}`, status: 'NEW', createdAt: new Date(), pdfUrl: null, ...data, customer: { id: 1, name: payload.name, phone: payload.phone, email: null, location: payload.location } };
        quotes.push(quote); return quote;
      },
    },
  });
  return { quotes, restore() { prisma.$transaction = originals.transaction; prisma.quoteRequest.findUnique = originals.findUnique; productService.getQuoteProductPricing = originals.pricing; } };
}

test('same idempotency key reuses one quotation, including concurrent requests', async (context) => {
  const state = installHarness(); context.after(() => state.restore());
  const [first, second] = await Promise.all([quoteService.createQuote(payload, { idempotencyKey: 'quote-key-0001' }), quoteService.createQuote(payload, { idempotencyKey: 'quote-key-0001' })]);
  assert.equal(state.quotes.length, 1); assert.equal(first.quote.id, second.quote.id); assert.equal([first.reused, second.reused].includes(true), true);
  const replay = await quoteService.createQuote(payload, { idempotencyKey: 'quote-key-0001' });
  assert.equal(replay.quote.id, first.quote.id); assert.equal(replay.reused, true);
});

test('same key with different material request conflicts; different and missing keys create separately', async (context) => {
  const state = installHarness(); context.after(() => state.restore());
  await quoteService.createQuote(payload, { idempotencyKey: 'quote-key-0002' });
  await assert.rejects(quoteService.createQuote({ ...payload, quantity: 200 }, { idempotencyKey: 'quote-key-0002' }), (error) => error.statusCode === 409);
  await quoteService.createQuote(payload, { idempotencyKey: 'quote-key-0003' });
  await quoteService.createQuote(payload);
  await quoteService.createQuote(payload);
  assert.equal(state.quotes.length, 4);
});
