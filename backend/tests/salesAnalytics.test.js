const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../services/analyticsService');
const { _private: salesGridPrivate } = require('../services/salesGridService');
const { offlineSaleSchema, salesGridUpdateSchema } = require('../validators/salesValidator');

const validOfflineSale = {
  customerName: 'Ravi Kumar',
  customerPhone: '9876543210',
  location: 'Tirupati',
  product: 'Fly Ash Bricks',
  quantity: 1000,
  unitPrice: 10,
  invoicedAmount: 10000,
  receivedAmount: 4000,
  saleDate: '2026-07-20',
  receivedDate: '2026-07-20',
  paymentMethod: 'UPI',
  notes: 'Site delivery.',
};

test('accepts a valid editable offline sale', () => {
  const parsed = offlineSaleSchema.parse(validOfflineSale);
  assert.equal(parsed.quantity, 1000);
  assert.equal(parsed.receivedAmount, 4000);
});

test('rejects received amount above the invoice amount', () => {
  const parsed = offlineSaleSchema.safeParse({
    ...validOfflineSale,
    receivedAmount: 11000,
  });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues[0].path[0], 'receivedAmount');
});

test('requires a received date when money has been collected', () => {
  const parsed = offlineSaleSchema.safeParse({
    ...validOfflineSale,
    receivedDate: '',
  });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues[0].path[0], 'receivedDate');
});

test('accepts mixed quote and offline spreadsheet updates', () => {
  const parsed = salesGridUpdateSchema.parse({
    updates: [
      {
        type: 'QUOTE',
        id: 1,
        expectedUpdatedAt: '2026-07-31T10:00:00.000Z',
        data: {
          customerName: 'Ravi Kumar',
          customerPhone: '9876543210',
          location: 'Tirupati',
          product: 'Fly Ash Bricks',
          quantity: 1000,
          invoicedAmount: 10000,
        },
      },
      {
        type: 'OFFLINE',
        id: 2,
        expectedUpdatedAt: '2026-07-31T10:00:00.000Z',
        data: validOfflineSale,
      },
    ],
  });
  assert.equal(parsed.updates.length, 2);
  assert.equal(parsed.updates[0].data.invoicedAmount, 10000);
  assert.equal(parsed.updates[1].data.receivedAmount, 4000);
});

test('does not accept received-payment edits on quote spreadsheet rows', () => {
  const parsed = salesGridUpdateSchema.safeParse({
    updates: [{
      type: 'QUOTE',
      id: 1,
      expectedUpdatedAt: '2026-07-31T10:00:00.000Z',
      data: {
        customerName: 'Ravi Kumar',
        customerPhone: '9876543210',
        location: 'Tirupati',
        product: 'Fly Ash Bricks',
        quantity: 1000,
        invoicedAmount: 10000,
        receivedAmount: 10000,
      },
    }],
  });
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error.issues), /receivedAmount/);
});

test('spreadsheet updates reject stale record versions', () => {
  assert.doesNotThrow(() => salesGridPrivate.assertCurrent(
    { updatedAt: new Date('2026-07-31T10:00:00.000Z') },
    '2026-07-31T10:00:00.000Z',
    'updates.0',
  ));
  assert.throws(
    () => salesGridPrivate.assertCurrent(
      { updatedAt: new Date('2026-07-31T10:01:00.000Z') },
      '2026-07-31T10:00:00.000Z',
      'updates.0',
    ),
    /changed after you opened it/i,
  );
});

test('quote sales ignore failed payments when calculating collections', () => {
  const row = _private.quoteSaleRow({
    id: 1,
    enquiryNumber: 'SSB-20260720-0001',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
    customer: {
      name: 'Ravi Kumar',
      phone: '9876543210',
      location: 'Tirupati',
    },
    product: 'Fly Ash Bricks',
    quantity: 1000,
    finalAmount: 10000,
    status: 'QUOTATION_SENT',
    source: 'WEBSITE',
    crmNotes: null,
    payments: [{
      amount: 10000,
      status: 'FAILED',
      paymentMethod: 'upi',
      updatedAt: new Date('2026-07-20T00:00:00.000Z'),
    }],
  }, new Map([['fly ash bricks', { unit: 'brick' }]]));

  assert.equal(row.receivedAmount, 0);
  assert.equal(row.outstandingAmount, 10000);
  assert.equal(row.status, 'OUTSTANDING');
});

test('analytics combines quote and offline sales without counting an unpaid quote as converted', () => {
  const product = {
    name: 'Fly Ash Bricks',
    standardPrice: 10,
    bulkPrice: 8,
    bulkQuantity: 10000,
    unit: 'brick',
    availability: 'IN_STOCK',
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };
  const lead = {
    id: 1,
    enquiryNumber: 'SSB-20260710-0001',
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    status: 'QUOTATION_SENT',
    source: 'WEBSITE',
    priority: 'MEDIUM',
    assignedTo: null,
    nextFollowUpDate: null,
    deliveryDate: null,
    product: product.name,
    quantity: 1000,
    finalAmount: 10000,
    customer: {
      name: 'Ravi Kumar',
      phone: '9876543210',
      location: 'Tirupati',
    },
    payments: [],
  };
  const result = _private.aggregateAnalytics({
    start: new Date('2026-07-01T00:00:00.000Z'),
    allLeads: [lead],
    leads: [lead],
    products: [product],
    productMap: new Map([[product.name.toLowerCase(), product]]),
    activities: [],
    priceHistory: [],
    sales: [
      {
        type: 'QUOTE',
        recordId: 1,
        product: product.name,
        unit: product.unit,
        status: 'OUTSTANDING',
        invoicedAmount: 10000,
        receivedAmount: 0,
        outstandingAmount: 10000,
        saleDate: new Date('2026-07-10T00:00:00.000Z'),
        receivedDate: null,
      },
      {
        type: 'OFFLINE',
        recordId: 2,
        product: product.name,
        unit: product.unit,
        status: 'PARTIAL',
        invoicedAmount: 20000,
        receivedAmount: 5000,
        outstandingAmount: 15000,
        saleDate: new Date('2026-07-11T00:00:00.000Z'),
        receivedDate: new Date('2026-07-11T00:00:00.000Z'),
      },
    ],
  }, 'LAST_30_DAYS', new Date('2026-07-29T00:00:00.000Z'));

  assert.equal(result.metrics.invoicedAmount, 30000);
  assert.equal(result.metrics.receivedAmount, 5000);
  assert.equal(result.metrics.outstandingAmount, 25000);
  assert.equal(result.metrics.conversionRate, 0);
  assert.equal(result.productPerformance[0].sales, 2);
});
