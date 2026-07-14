const test = require('node:test');
const assert = require('node:assert/strict');
const { createQuotePdfBuffer } = require('../services/pdfService');
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
  },
};

test('generates a selectable PDF buffer for a quote', () => {
  const pdf = createQuotePdfBuffer(quoteData);

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.slice(0, 8).toString(), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /\/Helvetica/);
  assert.match(pdf.toString('latin1'), /trailer/);
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
