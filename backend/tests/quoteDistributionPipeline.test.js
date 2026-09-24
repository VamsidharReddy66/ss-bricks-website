const test = require('node:test');
const assert = require('node:assert/strict');
const { createQuotePdfBuffer, generateAndStoreQuotePdf } = require('../services/pdfService');
const { GoogleSheetsService, __private: sheetsPrivate } = require('../services/googleSheetsService');

const quoteData = {
  customer: {
    name: 'Ramesh Builder',
    phone: '9876543210',
    location: 'Tirupati',
  },
  quote: {
    id: 1,
    enquiryNumber: 'SSB-20260715-0008',
    product: 'Fly Ash Bricks',
    quantity: 15000,
    deliveryDate: new Date('2026-07-20T00:00:00.000Z'),
    message: 'Need morning delivery.',
    status: 'NEW',
    source: 'WEBSITE',
    createdAt: new Date('2026-07-15T08:15:00.000Z'),
    quotedUnitPrice: 8.1,
    lineAmount: 121500,
    subtotal: 121500,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    grandTotal: 121500,
    amountInWords: 'One Lakh Twenty One Thousand Five Hundred Rupees Only',
  },
};

test('generates a searchable reference-template PDF for a quote', async () => {
  const pdf = await createQuotePdfBuffer(quoteData);

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.match(pdf.slice(0, 8).toString(), /^%PDF-1\./);
  assert.match(pdf.toString('latin1'), /\/Helvetica/);
  assert.match(pdf.toString('latin1'), /trailer/);
});

test('stores one canonical quotation PDF for download and email reuse', async () => {
  const calls = { upsert: null, update: null };
  const prismaClient = {
    quoteDocument: {
      upsert: async (payload) => { calls.upsert = payload; },
    },
    quoteRequest: {
      update: async (payload) => { calls.update = payload; },
    },
  };

  const result = await generateAndStoreQuotePdf(quoteData, prismaClient);
  assert.equal(result.fileName, 'quotation-SSB-20260715-0008.pdf');
  assert.equal(result.pdfUrl, '/api/quotes/SSB-20260715-0008/pdf');
  assert.equal(Buffer.isBuffer(result.content), true);
  assert.equal(calls.upsert.create.content, result.content);
  assert.equal(calls.update.data.pdfUrl, result.pdfUrl);
});

test('maps Google Sheet headers dynamically by known names', () => {
  assert.equal(sheetsPrivate.fieldForHeader('Mobile Number'), 'phone');
  assert.equal(sheetsPrivate.fieldForHeader('Required Delivery Date'), 'deliveryDate');
  assert.equal(sheetsPrivate.fieldForHeader('Unsupported Column'), null);

  const values = sheetsPrivate.quoteValues(quoteData, {
    pdfGenerated: true,
    emailSent: false,
    whatsappSent: true,
  });

  assert.equal(values.enquiryNumber, 'SSB-20260715-0008');
  assert.equal(values.pdfGenerated, 'Yes');
  assert.equal(values.emailSent, 'No');
  assert.equal(values.whatsappSent, 'Yes');
});

test('validates missing Google Sheets configuration without network calls', () => {
  const validation = sheetsPrivate.validateConfig({
    enabled: true,
    spreadsheetId: '',
    clientEmail: '',
    privateKey: '',
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /GOOGLE_SHEET_ID/);
});

test('creates the configured Google Sheet tab before appending quote rows', async () => {
  const calls = [];
  const service = new GoogleSheetsService({
    config: {
      enabled: true,
      spreadsheetId: 'sheet-id',
      sheetName: 'Quotes',
      clientEmail: 'service@example.test',
      privateKey: 'test-key',
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });

      if (String(url).includes('oauth2.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        };
      }

      if (String(url).endsWith('?fields=sheets.properties.title')) {
        return {
          ok: true,
          json: async () => ({
            sheets: [{ properties: { title: 'Sheet1' } }],
          }),
        };
      }

      if (String(url).endsWith(':batchUpdate')) {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      if (String(url).includes('/values/Quotes!1%3A1')) {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      if (String(url).includes('/values/Quotes!A1')) {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      if (String(url).includes('/values/Quotes!A%3AZ:append')) {
        return {
          ok: true,
          json: async () => ({}),
        };
      }

      throw new Error(`Unexpected URL ${url}`);
    },
  });

  service.getAccessToken = async () => 'token';
  await service.appendQuote(quoteData, {
    pdfGenerated: true,
    emailSent: true,
    whatsappSent: false,
  });

  assert.equal(calls.some((call) => String(call.url).endsWith(':batchUpdate')), true);
  assert.equal(calls.some((call) => String(call.url).includes('/values/Quotes!A%3AZ:append')), true);
});
