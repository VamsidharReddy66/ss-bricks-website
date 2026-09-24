const test = require('node:test');
const assert = require('node:assert/strict');
const { amountToWords, calculateQuotation } = require('../services/quotationPricingService');

const product = {
  id: 2,
  name: 'Solid Cement Blocks',
  standardPrice: '42.00',
  bulkPrice: '39.00',
  bulkQuantity: 2000,
  unit: 'block',
};

test('calculates a quotation from the authoritative standard product price', () => {
  const result = calculateQuotation(product, 500);
  assert.equal(result.productId, 2);
  assert.equal(result.unitPrice.toString(), '42');
  assert.equal(result.lineAmount.toString(), '21000');
  assert.equal(result.grandTotal.toString(), '21000');
  assert.equal(result.amountInWords, 'Twenty One Thousand Rupees Only');
  assert.equal(result.priceType, 'STANDARD');
});

test('uses the current bulk price when the configured threshold is reached', () => {
  const result = calculateQuotation(product, 2000);
  assert.equal(result.unitPrice.toString(), '39');
  assert.equal(result.lineAmount.toString(), '78000');
  assert.equal(result.priceType, 'BULK');
});

test('a stored quotation snapshot is independent of later product price changes', () => {
  const originalProduct = { ...product };
  const snapshot = calculateQuotation(originalProduct, 500);
  originalProduct.standardPrice = '45.00';
  assert.equal(snapshot.unitPrice.toString(), '42');
  assert.equal(snapshot.grandTotal.toString(), '21000');
});

test('converts rupees and paise into Indian amount words', () => {
  assert.equal(amountToWords('125001.50'), 'One Lakh Twenty Five Thousand One Rupees and Fifty Paise Only');
});
