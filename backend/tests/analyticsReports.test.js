const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../services/analyticsService');

function fixture() {
  const products = [
    {
      name: 'Fly Ash Bricks',
      standardPrice: 10,
      bulkPrice: 8,
      bulkQuantity: 10000,
      unit: 'brick',
      availability: 'IN_STOCK',
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    {
      name: 'Paver Blocks',
      standardPrice: 25,
      bulkPrice: 22,
      bulkQuantity: 500,
      unit: 'block',
      availability: 'OUT_OF_STOCK',
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    },
  ];
  const leads = [
    {
      id: 1,
      enquiryNumber: 'SSB-20260705-0001',
      createdAt: new Date('2026-07-05T00:00:00.000Z'),
      status: 'NEW',
      source: 'CSV_IMPORT',
      priority: 'HIGH',
      assignedTo: null,
      nextFollowUpDate: new Date('2026-07-20T00:00:00.000Z'),
      deliveryDate: new Date('2026-07-20T00:00:00.000Z'),
      product: 'Not specified',
      quantity: 0,
      finalAmount: null,
      customer: {
        name: 'Incomplete Import',
        phone: '9000000001',
        location: 'Tirupati',
      },
      payments: [{
        amount: 1000,
        status: 'FAILED',
        paymentMethod: 'UPI',
        failureReason: 'Test failure',
        updatedAt: new Date('2026-07-25T00:00:00.000Z'),
      }],
    },
    {
      id: 2,
      enquiryNumber: 'SSB-20260710-0002',
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
      status: 'FOLLOW_UP',
      source: 'WEBSITE',
      priority: 'MEDIUM',
      assignedTo: 'Sales Team',
      nextFollowUpDate: new Date('2026-07-29T00:00:00.000Z'),
      deliveryDate: new Date('2026-08-01T00:00:00.000Z'),
      product: 'Paver Blocks',
      quantity: 1000,
      finalAmount: null,
      customer: {
        name: 'Paver Customer',
        phone: '9000000002',
        location: 'Renigunta',
      },
      payments: [],
    },
    {
      id: 3,
      enquiryNumber: 'SSB-20260715-0003',
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
      status: 'WON',
      source: 'PHONE',
      priority: 'MEDIUM',
      assignedTo: 'Sales Team',
      nextFollowUpDate: null,
      deliveryDate: null,
      product: 'Fly Ash Bricks',
      quantity: 500,
      finalAmount: 5000,
      customer: {
        name: 'Converted Customer',
        phone: '9000000003',
        location: 'Tirupati',
      },
      payments: [{
        amount: 5000,
        status: 'SUCCESS',
        paymentMethod: 'UPI',
        failureReason: null,
        updatedAt: new Date('2026-07-28T00:00:00.000Z'),
      }],
    },
  ];
  return {
    start: new Date('2026-07-01T00:00:00.000Z'),
    allLeads: leads,
    leads,
    products,
    productMap: new Map(products.map((product) => [product.name.toLowerCase(), product])),
    activities: [
      {
        leadId: 2,
        type: 'STATUS_CHANGE',
        createdAt: new Date('2026-07-28T00:00:00.000Z'),
        admin: { name: 'Sales Admin' },
      },
      {
        leadId: 2,
        type: 'NOTE',
        createdAt: new Date('2026-07-28T01:00:00.000Z'),
        admin: { name: 'Sales Admin' },
      },
      {
        leadId: 1,
        type: 'LEAD_CREATED',
        createdAt: new Date('2026-07-05T00:00:00.000Z'),
        admin: null,
      },
    ],
    priceHistory: [{
      priceType: 'STANDARD',
      oldPrice: 9,
      newPrice: 10,
      updatedAt: new Date('2026-07-20T00:00:00.000Z'),
      product: { name: 'Fly Ash Bricks' },
      admin: { name: 'Sales Admin' },
    }],
    sales: [
      {
        type: 'QUOTE',
        recordId: 3,
        saleNumber: 'SSB-20260715-0003',
        customerName: 'Converted Customer',
        customerPhone: '9000000003',
        location: 'Tirupati',
        product: 'Fly Ash Bricks',
        unit: 'brick',
        status: 'PAID',
        invoicedAmount: 5000,
        receivedAmount: 5000,
        outstandingAmount: 0,
        saleDate: new Date('2026-07-28T00:00:00.000Z'),
        receivedDate: new Date('2026-07-28T00:00:00.000Z'),
        paymentMethod: 'UPI',
      },
      {
        type: 'OFFLINE',
        recordId: 4,
        saleNumber: 'OFF-20260710-0001',
        customerName: 'Offline Customer',
        customerPhone: '9000000004',
        location: 'Tirupati',
        product: 'Fly Ash Bricks',
        unit: 'brick',
        status: 'PARTIAL',
        invoicedAmount: 10000,
        receivedAmount: 4000,
        outstandingAmount: 6000,
        saleDate: new Date('2026-07-10T00:00:00.000Z'),
        receivedDate: new Date('2026-07-10T00:00:00.000Z'),
        paymentMethod: 'CASH',
      },
    ],
  };
}

function reports() {
  return _private.aggregateAnalytics(
    fixture(),
    'LAST_30_DAYS',
    new Date('2026-07-29T12:00:00.000Z'),
  );
}

test('marketing analytics exposes follow-up and data-quality exceptions from lead records', () => {
  const result = reports();
  assert.equal(result.marketing.metrics.overdueFollowUps, 1);
  assert.equal(result.marketing.metrics.dueToday, 1);
  assert.equal(result.marketing.dataQuality.zeroQuantity, 1);
  assert.equal(result.marketing.dataQuality.unspecifiedProduct, 1);
  assert.equal(result.marketing.metrics.convertedLeads, 1);
});

test('finance analytics separates failed attempts from collected revenue and ages receivables', () => {
  const result = reports();
  assert.equal(result.finance.metrics.invoicedAmount, 15000);
  assert.equal(result.finance.metrics.receivedAmount, 9000);
  assert.equal(result.finance.metrics.paymentAttempts, 2);
  assert.equal(result.finance.metrics.failedAttempts, 1);
  assert.equal(result.finance.receivableAging.find((row) => row.key === 'DUE_30').amount, 6000);
  assert.equal(result.finance.dataCoverage.profitAndLoss, false);
});

test('operations analytics detects overdue delivery and active demand on out-of-stock products', () => {
  const result = reports();
  assert.equal(result.operations.metrics.overdueDeliveries, 1);
  assert.equal(result.operations.metrics.demandOnOutOfStock, 1000);
  assert.equal(result.operations.upcomingDeliveries[0].enquiryNumber, 'SSB-20260710-0002');
  assert.equal(result.operations.dataCoverage.productionOutput, false);
});

test('team analytics reports assignment workload without inventing HR records', () => {
  const result = reports();
  assert.equal(result.team.metrics.unassignedLeads, 1);
  assert.equal(result.team.metrics.recordedActivities, 3);
  assert.equal(result.team.activityPerformance[0].name, 'Sales Admin');
  assert.equal(result.team.dataCoverage.attendance, false);
  assert.equal(result.team.dataCoverage.payroll, false);
});

test('insights are deterministic and point to the supporting report', () => {
  const result = reports();
  const titles = result.insights.map((item) => item.title);
  assert.ok(titles.includes('Overdue lead follow-ups require attention'));
  assert.ok(titles.includes('Demand exists for an unavailable product'));
  assert.ok(titles.includes('Payment attempts are failing'));
  assert.ok(result.insights.every((item) => (
    ['CRITICAL', 'WARNING', 'OPPORTUNITY', 'INFO'].includes(item.severity)
    && ['marketing', 'sales', 'finance', 'operations', 'team', 'overview'].includes(item.target)
  )));
});
