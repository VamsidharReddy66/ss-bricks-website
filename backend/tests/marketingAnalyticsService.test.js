const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../services/marketingAnalyticsService');

test('marketing lead rows expose the stored quotation PDF path', () => {
  const lead = _private.serializeLead({
    id: 27,
    enquiryNumber: 'SSB-20260929-0027',
    createdAt: new Date('2026-09-29T04:00:00.000Z'),
    customer: {
      name: 'Test Customer',
      phone: '919800000027',
      location: 'Tirupati',
    },
    company: null,
    product: 'Fly Ash Bricks',
    quantity: 2000,
    priority: 'MEDIUM',
    status: 'QUOTATION_SENT',
    nextFollowUpDate: null,
    source: 'WEBSITE',
    pdfUrl: '/api/quotes/SSB-20260929-0027/pdf',
  });

  assert.equal(lead.pdfUrl, '/api/quotes/SSB-20260929-0027/pdf');
  assert.equal(lead.enquiryNumber, 'SSB-20260929-0027');
});
