const test = require('node:test');
const assert = require('node:assert/strict');
const { NotificationService } = require('../services/notificationService');
const realWanamaste = require('../services/wanamasteService');

const quoteData = {
  customer: {
    name: 'Test Customer',
    phone: '9876543210',
    email: 'customer@example.test',
    location: 'Tirupati',
  },
  quote: {
    id: 73,
    enquiryNumber: 'SSB-20260926-0073',
    product: 'Fly Ash Bricks',
    quantity: 1000,
    status: 'NEW',
    createdAt: new Date('2026-09-26T06:00:00.000Z'),
  },
  pdf: {
    fileName: 'quotation-SSB-20260926-0073.pdf',
    contentType: 'application/pdf',
    content: Buffer.from('%PDF-1.7 test'),
    pdfUrl: '/api/quotes/SSB-20260926-0073/pdf',
  },
};

function harness({ providerResult = { success: true, httpStatus: 200 }, providerError = null, statusUpdateFails = false } = {}) {
  const logs = [];
  const activities = [];
  const requests = [];
  const messages = [];

  const prismaClient = {
    notificationLog: {
      create: async ({ data }) => {
        if (data.deduplicationKey && logs.some((log) => log.deduplicationKey === data.deduplicationKey)) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const log = { ...data };
        logs.push(log);
        return log;
      },
      update: async ({ where, data }) => {
        if (statusUpdateFails) throw new Error('Database unavailable');
        const log = logs.find((item) => item.deduplicationKey === where.deduplicationKey);
        Object.assign(log, data);
        return log;
      },
    },
    leadActivity: {
      create: async ({ data }) => {
        activities.push(data);
        return data;
      },
    },
  };

  const providerConfig = {
    apiBaseUrl: 'https://wanamaste.example.test/api',
    vendorUid: 'vendor-secret',
    apiToken: 'token-secret',
  };
  const wanamaste = {
    normalizeWanamastePhone: realWanamaste.normalizeWanamastePhone,
    buildPublicDocumentUrl: realWanamaste.buildPublicDocumentUrl,
    sendQuotationTemplate: async (input) => {
      const request = realWanamaste.buildQuotationTemplateRequest({ ...input, config: providerConfig });
      requests.push(request);
      if (providerError) throw providerError;
      return providerResult;
    },
  };
  const logger = {
    info: (...args) => messages.push(args.join(' ')),
    error: (...args) => messages.push(args.join(' ')),
  };

  return {
    activities,
    logs,
    messages,
    requests,
    service: new NotificationService({
      prismaClient,
      wanamaste,
      publicSiteUrl: 'https://ssbricks.example.test',
      logger,
      emailService: {
        getRecipient: () => 'customer@example.test',
        sendQuoteNotification: async () => ({ status: 'SUCCESS' }),
      },
      googleSheetsService: { appendQuote: async () => ({ status: 'SUCCESS' }) },
      pdfGenerator: async () => quoteData.pdf,
    }),
  };
}

test('automatic quotation delivery maps the canonical quote and PDF to the verified template', async () => {
  const state = harness();

  const result = await state.service.sendWanamasteQuotation(structuredClone(quoteData));

  assert.equal(result.status, 'SUCCESS');
  assert.equal(state.requests.length, 1);
  assert.deepEqual(state.requests[0].body, {
    phone_number: '919876543210',
    template_name: 'quotation_ready',
    template_language: 'en',
    header_document: 'https://ssbricks.example.test/api/quotes/SSB-20260926-0073/pdf',
    header_document_name: 'quotation-SSB-20260926-0073.pdf',
    field_1: 'Test Customer',
    field_2: 'SSB-20260926-0073',
  });
  assert.equal(state.logs[0].status, 'SUCCESS');
  assert.equal(state.logs[0].recipient, 'WhatsApp ending 3210');
});

test('persistent delivery claim prevents a duplicate automatic WAnamaste send', async () => {
  const state = harness();

  const first = await state.service.sendWanamasteQuotation(structuredClone(quoteData));
  const second = await state.service.sendWanamasteQuotation(structuredClone(quoteData));

  assert.equal(first.status, 'SUCCESS');
  assert.deepEqual(second, { status: 'SKIPPED', reason: 'ALREADY_CLAIMED' });
  assert.equal(state.requests.length, 1);
  assert.equal(state.logs.filter((log) => log.type === 'WHATSAPP').length, 1);
});

test('provider failure is recorded without disrupting PDF, email, or quote completion', async () => {
  const state = harness({
    providerResult: {
      success: false,
      httpStatus: 503,
      responseBody: { status: 'rejected' },
      failureCode: 'PROVIDER_REJECTED',
    },
  });
  const data = structuredClone(quoteData);

  const result = await state.service.notifyQuoteCreated(data);

  assert.equal(result.pdf.status, 'SUCCESS');
  assert.equal(result.email.status, 'SUCCESS');
  assert.equal(result.whatsapp.status, 'FAILED');
  assert.equal(result.googleSheet.status, 'SUCCESS');
  assert.equal(state.requests.length, 1);
  const log = state.logs.find((item) => item.type === 'WHATSAPP');
  assert.equal(log.status, 'FAILED');
  assert.equal(log.errorMessage, 'PROVIDER_REJECTED');
});

test('timeout remains ambiguous and claimed, so the pipeline never retries automatically', async () => {
  const state = harness({ providerResult: { success: false, httpStatus: null, failureCode: 'TIMEOUT' } });

  const first = await state.service.sendWanamasteQuotation(structuredClone(quoteData));
  const second = await state.service.sendWanamasteQuotation(structuredClone(quoteData));

  assert.equal(first.status, 'PENDING');
  assert.equal(second.status, 'SKIPPED');
  assert.equal(state.requests.length, 1);
  assert.equal(state.logs[0].status, 'PENDING');
});

test('provider acceptance with status persistence failure is reported as ambiguous without a second send', async () => {
  const state = harness({ statusUpdateFails: true });
  const result = await state.service.sendWanamasteQuotation(structuredClone(quoteData));
  assert.deepEqual(result, { status: 'PENDING', errorMessage: 'PROVIDER_ACCEPTED_STATUS_PERSISTENCE_FAILED' });
  assert.equal(state.requests.length, 1);
  assert.equal(state.logs[0].status, 'PENDING');
});

test('delivery logs and errors never expose provider credentials or authorization headers', async () => {
  const state = harness({ providerError: new Error('Provider request failed') });

  await state.service.sendWanamasteQuotation(structuredClone(quoteData));

  const serialized = JSON.stringify({ logs: state.logs, messages: state.messages });
  assert.equal(serialized.includes('token-secret'), false);
  assert.equal(serialized.includes('vendor-secret'), false);
  assert.equal(serialized.includes('Authorization'), false);
  assert.equal(serialized.includes('9876543210'), false);
});
