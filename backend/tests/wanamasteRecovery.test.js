const test = require('node:test');
const assert = require('node:assert/strict');
const { NotificationService } = require('../services/notificationService');

function harness(status, provider = { success: true, httpStatus: 200 }) {
  const notification = { id: 9, status, recoveryAttemptCount: 0, deduplicationKey: 'WANAMASTE_QUOTE:42' };
  const audits = []; let sends = 0;
  const quote = { id: 42, enquiryNumber: 'SSB-Q-42', customer: { name: 'Stored Customer', phone: '9876543210' }, document: { fileName: 'quotation-SSB-Q-42.pdf' }, notificationLogs: [notification] };
  const prismaClient = {
    quoteRequest: { findUnique: async () => quote },
    notificationLog: { updateMany: async ({ where, data }) => { if (notification.status !== where.status || notification.recoveryAttemptCount !== 0) return { count: 0 }; notification.status = data.status; notification.recoveryAttemptCount += 1; return { count: 1 }; } },
    $transaction: async (callback) => callback({ notificationLog: { update: async ({ data }) => Object.assign(notification, data) }, whatsAppRecoveryAudit: { create: async ({ data }) => { audits.push(data); } }, leadActivity: { create: async () => ({}) } }),
  };
  const wanamaste = { normalizeWanamastePhone: () => '919876543210', buildPublicDocumentUrl: (path) => `https://ssbricks.example.test${path}`, sendQuotationTemplate: async (input) => { sends += 1; assert.equal(input.customerName, 'Stored Customer'); assert.match(input.documentUrl, /SSB-Q-42/); return provider; } };
  return { notification, audits, get sends() { return sends; }, service: new NotificationService({ prismaClient, wanamaste, publicSiteUrl: 'https://ssbricks.example.test', logger: { info() {}, error() {} } }) };
}

test('SUCCESS cannot retry and reason is required', async () => {
  const success = harness('SUCCESS');
  await assert.rejects(success.service.retryWanamasteQuotation(42, 1, { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: 'Customer asked again' }), (error) => error.statusCode === 409);
  const failed = harness('FAILED');
  await assert.rejects(failed.service.retryWanamasteQuotation(42, 1, { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: '' }), (error) => error.statusCode === 400);
  assert.equal(success.sends + failed.sends, 0);
});

test('FAILED permits one atomic quote-bound retry and records audit', async () => {
  const state = harness('FAILED');
  const recovery = { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: 'Customer requested quotation again', phoneNumber: '441234567890', documentUrl: 'https://attacker.example/file.pdf' };
  const [first, second] = await Promise.allSettled([state.service.retryWanamasteQuotation(42, 7, recovery), state.service.retryWanamasteQuotation(42, 7, recovery)]);
  assert.equal(state.sends, 1); assert.equal(first.status === 'fulfilled' || second.status === 'fulfilled', true); assert.equal(state.notification.status, 'SUCCESS'); assert.equal(state.audits.length, 1); assert.equal(state.audits[0].adminId, 7);
});

test('PENDING requires duplicate-risk acknowledgement and permits only one controlled retry', async () => {
  const state = harness('PENDING');
  await assert.rejects(state.service.retryWanamasteQuotation(42, 1, { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: 'Customer confirmed no receipt' }), /ambiguous/);
  const result = await state.service.retryWanamasteQuotation(42, 1, { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: 'Customer confirmed no receipt', acknowledgeDuplicateRisk: true });
  assert.equal(result.status, 'SUCCESS'); assert.equal(state.sends, 1);
});

test('timeout remains ambiguous and never triggers a second automatic provider call', async () => {
  const state = harness('FAILED', { success: false, httpStatus: null, failureCode: 'TIMEOUT' });
  const result = await state.service.retryWanamasteQuotation(42, 1, { confirmation: 'RETRY_QUOTATION_WHATSAPP', reason: 'Customer confirmed no receipt' });
  assert.equal(result.status, 'PENDING'); assert.equal(state.sends, 1); assert.equal(state.notification.status, 'PENDING');
});
