const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../config/database');
const businessLedgerService = require('../services/businessLedgerService');
const {
  inventoryCategoryLogSchema,
  recordSchemas,
  salesCustomerLogSchema,
  vendorPurchaseLogSchema,
} = require('../validators/businessValidator');

const createPayloads = {
  sales: { saleDate: '2026-08-30', customerName: 'Test Customer', customerPhone: '', location: '', productName: 'Fly Ash Bricks', quantity: 1000, quantityUnit: 'brick', unitPrice: 8, driverBatta: 0, invoicedAmount: 8000, paymentMethod: '', receivedTo: '', notes: '' },
  receipts: { receiptDate: '2026-08-30', saleId: null, customerName: 'Test Customer', amount: 4000, paymentMethod: 'UPI', receivedTo: 'Admin', reference: '', notes: '' },
  expenses: { expenseDate: '2026-08-30', category: 'FUEL', description: 'Diesel', amount: 1200, paymentMethod: 'CASH', paidBy: 'Admin', notes: '' },
  purchases: { purchaseDate: '2026-08-30', materialName: 'Cement', unitPrice: 350, quantity: 10, purchaseAmount: 3500, driverBatta: 0, vendorName: '', paidDate: '', paymentStatus: 'PAID', paymentMethod: 'UPI', paidBy: 'Admin', notes: '' },
  production: { recordDate: '2026-08-30', recordType: 'PRODUCTION', productName: 'Fly Ash Bricks', quantity: 5000, reason: '', qualityNote: '' },
  labour: { paymentDate: '2026-08-30', workDescription: 'Brick making', quantity: 5000, rawQuantity: '', brickMakingAmount: 2500, otherPaymentNote: '', totalAmount: 2500, pendingAmount: 0, paymentMethod: 'CASH', paidBy: 'Admin', notes: '' },
};

test('creates a manual, audited record for every visible business log', async () => {
  const originalTransaction = prisma.$transaction;
  const created = [];
  const audits = [];
  let nextId = 1;
  const model = {
    create: async ({ data }) => {
      const record = { id: nextId, ...data };
      nextId += 1;
      created.push(record);
      return record;
    },
  };
  const tx = {
    ledgerSale: model,
    ledgerReceipt: model,
    expenseEntry: model,
    materialPurchase: model,
    productionRecord: model,
    labourPayment: model,
    ledgerCustomer: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 99, ...data }),
    },
    businessAuditLog: {
      create: async ({ data }) => {
        audits.push(data);
        return data;
      },
    },
  };

  prisma.$transaction = async (callback) => callback(tx);
  try {
    for (const [type, payload] of Object.entries(createPayloads)) {
      const parsed = recordSchemas[type].parse(payload);
      const record = await businessLedgerService.createRecord(type, parsed, 7);
      assert.equal(record.origin, 'MANUAL');
      assert.equal(record.createdBy, 7);
    }
  } finally {
    prisma.$transaction = originalTransaction;
  }

  assert.equal(created.length, 6);
  assert.equal(audits.length, 6);
  assert.deepEqual(audits.map((entry) => entry.action), Array(6).fill('CREATE'));
});

test('summarizes customer sales using stored invoice and payment evidence', () => {
  const records = [
    {
      id: 1,
      customerName: 'Purushottam Naidu',
      customerPhone: '919999999999',
      location: 'Tirupati',
      invoicedAmount: 8900,
      sourceReceivedAmount: 8900,
      sourceOutstandingAmount: null,
    },
    {
      id: 2,
      customerName: 'Purushottam Naidu',
      customerPhone: null,
      location: null,
      invoicedAmount: 17800,
      sourceReceivedAmount: null,
      sourceOutstandingAmount: 4200,
    },
    {
      id: 3,
      customerName: 'Purushottam Naidu',
      customerPhone: null,
      location: null,
      invoicedAmount: 6000,
      sourceReceivedAmount: null,
      sourceOutstandingAmount: null,
    },
  ];

  const result = businessLedgerService.__private.summarizeSalesCustomer(null, records);

  assert.equal(result.customer.name, 'Purushottam Naidu');
  assert.equal(result.customer.phone, '919999999999');
  assert.equal(result.customer.location, 'Tirupati');
  assert.equal(result.customer.customerType, null);
  assert.equal(result.totalOrderValue, 32700);
  assert.deepEqual(result.sales.map((record) => record.paymentStatus), ['DONE', 'DUE', 'NOT_RECORDED']);
  assert.ok(result.sales.every((record) => record.invoiceAvailable === false));
});

test('validates customer log lookup inputs', () => {
  assert.deepEqual(salesCustomerLogSchema.parse({ customerId: '12', customerName: 'Test Customer' }), {
    customerId: 12,
    customerName: 'Test Customer',
  });
  assert.equal(salesCustomerLogSchema.safeParse({ customerName: '' }).success, false);
});

test('summarizes vendor purchases using recorded totals and payment markers', () => {
  const records = [
    {
      id: 11,
      vendorName: 'Ram Materials',
      materialName: 'Crusher dust 6mm',
      purchaseAmount: 22000,
      paymentStatus: 'PENDING',
    },
    {
      id: 12,
      vendorName: 'Ram Materials',
      materialName: 'Crusher dust 12mm',
      purchaseAmount: 23000,
      paymentStatus: 'PAID',
    },
    {
      id: 13,
      vendorName: 'Ram Materials',
      materialName: 'Crusher dust 12mm',
      purchaseAmount: 24000,
      paymentStatus: 'UNKNOWN',
    },
  ];
  const vendor = {
    id: 8,
    displayName: 'Ram Materials',
    phone: '919999999999',
    address: 'Tirupati',
    productService: 'Crusher dust',
  };

  const result = businessLedgerService.__private.summarizeVendorPurchases(vendor, records);

  assert.equal(result.vendor.name, 'Ram Materials');
  assert.equal(result.vendor.phone, '919999999999');
  assert.equal(result.vendor.address, 'Tirupati');
  assert.equal(result.totalOrderValue, 69000);
  assert.deepEqual(result.purchases.map((record) => record.displayPaymentStatus), ['DUE', 'DONE', 'NOT_RECORDED']);
  assert.ok(result.purchases.every((record) => record.invoiceAvailable === false));
});

test('validates vendor log lookup inputs', () => {
  assert.deepEqual(vendorPurchaseLogSchema.parse({ vendorId: '8', vendorName: 'Ram Materials' }), {
    vendorId: 8,
    vendorName: 'Ram Materials',
  });
  assert.equal(vendorPurchaseLogSchema.safeParse({ vendorName: '' }).success, false);
});

test('summarizes inventory purchases by their recorded material category', () => {
  const records = [
    {
      id: 21,
      materialName: 'Diesel Fuel',
      notes: '20 Litres of Diesel Fuel',
      purchaseAmount: 2077,
      paymentStatus: 'PENDING',
    },
    {
      id: 22,
      materialName: 'Diesel Fuel',
      notes: null,
      purchaseAmount: 2077,
      paymentStatus: 'PAID',
    },
  ];

  const result = businessLedgerService.__private.summarizeInventoryCategory('Diesel Fuel', records);

  assert.equal(result.category, 'Diesel Fuel');
  assert.equal(result.description, '20 Litres of Diesel Fuel');
  assert.equal(result.totalOrderValue, 4154);
  assert.deepEqual(result.purchases.map((record) => record.displayPaymentStatus), ['DUE', 'DONE']);
  assert.ok(result.purchases.every((record) => record.invoiceAvailable === false));
});

test('validates inventory category log lookup inputs', () => {
  assert.deepEqual(inventoryCategoryLogSchema.parse({ category: 'Power & Fuel Expense' }), {
    category: 'Power & Fuel Expense',
  });
  assert.equal(inventoryCategoryLogSchema.safeParse({ category: '' }).success, false);
});
