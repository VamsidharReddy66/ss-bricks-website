const test = require('node:test');
const assert = require('node:assert/strict');
const { materialItemSchema } = require('../validators/materialItemValidator');

const item = {
  itemCode: 'cem-01', itemName: 'Cement', category: 'Binder', subCategory: 'OPC', unit: 'bag',
  criticalItem: true, openingStock: 25, openingStockAsOn: '2026-10-25',
};

test('accepts item master input and normalizes the unique code', () => {
  const parsed = materialItemSchema.parse(item);
  assert.equal(parsed.itemCode, 'CEM-01');
  assert.equal(parsed.openingStock, 25);
  assert.equal(parsed.criticalItem, true);
});

test('requires item identity and opening-stock date', () => {
  assert.equal(materialItemSchema.safeParse({ ...item, subCategory: '' }).success, false);
  assert.equal(materialItemSchema.safeParse({ ...item, openingStockAsOn: null }).success, false);
});

test('rejects invalid planning quantities and calendar dates', () => {
  assert.equal(materialItemSchema.safeParse({ ...item, reorderLevel: -1 }).success, false);
  assert.equal(materialItemSchema.safeParse({ ...item, leadTimeDays: 1.5 }).success, false);
  assert.equal(materialItemSchema.safeParse({ ...item, openingStockAsOn: '2026-02-31' }).success, false);
});
