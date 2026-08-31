const test = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../config/database');
const businessLedgerService = require('../services/businessLedgerService');
const { recordSchemas } = require('../validators/businessValidator');

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
