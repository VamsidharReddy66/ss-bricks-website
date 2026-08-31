const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { __private: analyticsPrivate } = require('../services/businessAnalyticsService');
const { parseBusinessWorkbook } = require('../services/businessWorkbookParser');
const { listBusinessRecordsSchema, recordSchemas } = require('../validators/businessValidator');

function workbookBuffer() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Date', 'Type of expence', 'Amount', 'Payment Mode', 'Payment By', 'Note'],
    ['January'],
    ['02-01-2026', 'Diesel', 1200, 'Cash', 'Admin', 'Generator'],
    ['', 'Total', 1200],
  ]), 'Montly factory expences');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Date', 'Type of bricks', 'Cost per brick', 'No of loads bricks', 'Driver Barta', 'Customer Name', 'Delivery Location', 'Total Amount', 'Amount Received', 'Payment Received Date', 'Payment Mode', 'Received To', 'Pending Payments', 'Note', 'Customers Number'],
    ['', 'January'],
    ['03-01-2026', 'Fly Ash Bricks', 8, 1, 500, 'Test Customer', 'Tirupati', 8000, 4000, '04-01-2026', 'UPI', 'Admin', 4000, '', '9876543210'],
    ['', 'Total', '', 1, '', '', '', 8000, 4000, '', '', '', 4000],
  ]), 'Brick sales data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

test('normalizes semantic workbook headers and excludes source totals from transactions', () => {
  const parsed = parseBusinessWorkbook(workbookBuffer(), 'SS Bricks Data 2026.xlsx');
  assert.equal(parsed.summary.sales, 1);
  assert.equal(parsed.summary.expenses, 1);
  assert.equal(parsed.data.sales[0].customerName, 'Test Customer');
  assert.equal(parsed.data.sales[0].invoicedAmount, 8000);
  assert.equal(parsed.data.expenses[0].amount, 1200);
  assert.equal(parsed.reconciliation.salesInvoiced.status, 'MATCH');
  assert.equal(parsed.reconciliation.factoryExpenses.status, 'MATCH');
});

test('marks historical collections unavailable instead of deriving receivables from ambiguous cells', () => {
  const parsed = parseBusinessWorkbook(workbookBuffer(), 'SS Bricks Data 2026.xlsx');
  assert.equal(parsed.reconciliation.collections.status, 'UNAVAILABLE');
  assert.equal(parsed.reconciliation.receivables.status, 'UNAVAILABLE');
  assert.match(parsed.reconciliation.collections.note, /combined and text-only payments/i);
});

test('business analytics always filters active workbook-import records', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  assert.deepEqual(analyticsPrivate.workbookWhere(start), {
    recordState: 'ACTIVE',
    origin: 'XLSX_IMPORT',
    reportingMonth: { gte: start },
  });
});

test('business analytics calculates product revenue and recorded price summaries without inventing targets', () => {
  const rows = analyticsPrivate.salesProductBreakdown([
    { productName: '8-inch Cement Blocks', invoicedAmount: 10000, quantity: 1, unitPrice: 20 },
    { productName: '8-inch Cement Blocks', invoicedAmount: 12000, quantity: 1.2, unitPrice: 22 },
    { productName: 'Paver Blocks', invoicedAmount: 4000, quantity: 1, unitPrice: null },
  ]);

  assert.deepEqual(rows[0], {
    name: '8-inch Cement Blocks',
    records: 2,
    value: 22000,
    quantity: 2.2,
    averageUnitPrice: 21,
    pricedRecords: 2,
  });
  assert.equal(rows[1].averageUnitPrice, null);
});

test('reference coverage explains every unavailable reference metric from missing workbook fields', () => {
  const coverage = analyticsPrivate.referenceCoverage();
  const unavailable = coverage.filter((row) => row.status === 'UNAVAILABLE');
  assert.equal(coverage.filter((row) => row.status === 'SUPPORTED').length, 5);
  assert.equal(unavailable.length, 5);
  assert.ok(unavailable.some((row) => row.area === 'Marketing' && /no enquiry/i.test(row.reason)));
  assert.ok(unavailable.some((row) => row.area === 'Finance' && /combined or cumulative/i.test(row.reason)));
  assert.ok(unavailable.some((row) => row.area === 'HR' && /no employee roster/i.test(row.reason)));
});

test('count-only breakdowns rank no-production reasons by row frequency', () => {
  const rows = analyticsPrivate.breakdown([
    { reason: 'Rain' },
    { reason: 'Delivery' },
    { reason: 'Rain' },
  ], 'reason', null);
  assert.deepEqual(rows.map((row) => [row.name, row.records]), [['Rain', 2], ['Delivery', 1]]);
});

test('business insights prioritize actionable workbook signals with department ownership', () => {
  const insights = analyticsPrivate.buildInsights({
    trust: {
      reviewRows: 12,
      reconciliation: [{ status: 'MISMATCH' }],
    },
    sales: {
      invoicedAmount: 100000,
      collectionsAvailable: false,
      monthly: [
        { label: 'Jun 26', invoiced: 70000 },
        { label: 'Jul 26', invoiced: 100000 },
      ],
      products: [{ name: 'Fly Ash Bricks', value: 80000 }],
    },
    finance: {
      recordedOutflows: 130000,
      pendingPurchaseValue: 25000,
    },
    operations: {
      pendingPurchases: 2,
      noProductionDays: 10,
      productionLineItems: 40,
      noProductionReasons: [{ name: 'Rain', records: 6 }],
    },
  });

  assert.match(insights[0].title, /outflows are 30\.0% above/i);
  assert.equal(insights[0].severity, 'CRITICAL');
  assert.equal(insights[0].department, 'Finance');
  assert.equal(insights[1].severity, 'OPPORTUNITY');
  assert.equal(insights[1].department, 'Sales');
  assert.deepEqual(insights.slice(0, 5).map((row) => row.department), [
    'Finance',
    'Sales',
    'Finance',
    'Operations',
    'Sales',
  ]);
  assert.equal(insights.at(-1).department, 'Data Quality');
});

test('business log queries accept an explicit workbook-only origin', () => {
  const query = listBusinessRecordsSchema.parse({ origin: 'XLSX_IMPORT' });
  assert.equal(query.origin, 'XLSX_IMPORT');
  assert.equal(query.state, 'ACTIVE');
});

test('accepts create payloads for every visible business log', () => {
  const payloads = {
    sales: { saleDate: '2026-08-30', customerName: 'Test Customer', customerPhone: '', location: '', productName: 'Fly Ash Bricks', quantity: 1000, quantityUnit: 'brick', unitPrice: 8, driverBatta: 0, invoicedAmount: 8000, paymentMethod: '', receivedTo: '', notes: '' },
    receipts: { receiptDate: '2026-08-30', saleId: null, customerName: 'Test Customer', amount: 4000, paymentMethod: 'UPI', receivedTo: 'Admin', reference: '', notes: '' },
    expenses: { expenseDate: '2026-08-30', category: 'FUEL', description: 'Diesel', amount: 1200, paymentMethod: 'CASH', paidBy: 'Admin', notes: '' },
    purchases: { purchaseDate: '2026-08-30', materialName: 'Cement', unitPrice: 350, quantity: 10, purchaseAmount: 3500, driverBatta: 0, vendorName: '', paidDate: '', paymentStatus: 'PAID', paymentMethod: 'UPI', paidBy: 'Admin', notes: '' },
    production: { recordDate: '2026-08-30', recordType: 'PRODUCTION', productName: 'Fly Ash Bricks', quantity: 5000, reason: '', qualityNote: '' },
    labour: { paymentDate: '2026-08-30', workDescription: 'Brick making', quantity: 5000, rawQuantity: '', brickMakingAmount: 2500, otherPaymentNote: '', totalAmount: 2500, pendingAmount: 0, paymentMethod: 'CASH', paidBy: 'Admin', notes: '' },
  };

  Object.entries(payloads).forEach(([type, payload]) => {
    const result = recordSchemas[type].safeParse(payload);
    assert.equal(result.success, true, `${type} create payload should be valid`);
  });
});

const suppliedWorkbook = path.resolve('C:/Users/pooji/Downloads/SS Bricks Factory Data 2026-2027 .xlsx');
test('reconciles the complete supplied SS Bricks workbook', {
  skip: !fs.existsSync(suppliedWorkbook),
}, () => {
  const parsed = parseBusinessWorkbook(fs.readFileSync(suppliedWorkbook), path.basename(suppliedWorkbook));
  assert.deepEqual(parsed.summary, {
    sourceRows: 936,
    importedRows: 494,
    reviewRows: 306,
    skippedRows: 136,
    sales: 211,
    receipts: 155,
    expenses: 248,
    materialPurchases: 67,
    productionRecords: 200,
    labourPayments: 27,
    vendors: 6,
    customerReferences: 6,
  });
  assert.deepEqual(parsed.reconciliation.salesInvoiced, {
    source: 2301275,
    normalized: 2301275,
    analytics: 2301275,
    discrepancy: 0,
    status: 'MATCH',
    note: null,
  });
  assert.equal(parsed.reconciliation.factoryExpenses.discrepancy, -4320);
  assert.equal(parsed.reconciliation.productionOutput.discrepancy, 2770);
  assert.equal(parsed.reconciliation.collections.status, 'UNAVAILABLE');
  assert.equal(parsed.reconciliation.receivables.status, 'UNAVAILABLE');
});
