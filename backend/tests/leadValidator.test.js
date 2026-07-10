const test = require('node:test');
const assert = require('node:assert/strict');
const {
  importCommitSchema,
  leadActivitySchema,
  leadCreateSchema,
  leadStatusUpdateSchema,
  leadUpdateSchema,
} = require('../validators/leadValidator');
const { __private: leadImportPrivate } = require('../services/leadImportService');

const validLead = {
  name: 'Ravi Kumar',
  phone: '+91 98765 43210',
  location: 'Tirupati',
  product: 'Fly Ash Bricks',
  quantity: '10000',
  source: 'PHONE',
  priority: 'HIGH',
  notes: 'Asked for builder pricing.',
};

test('accepts a valid manual lead and normalizes phone and quantity', () => {
  const parsed = leadCreateSchema.parse(validLead);

  assert.equal(parsed.phone, '9876543210');
  assert.equal(parsed.quantity, 10000);
  assert.equal(parsed.status, 'NEW');
});

test('accepts zero quantity for admin leads', () => {
  const parsed = leadCreateSchema.parse({
    ...validLead,
    quantity: '0',
  });

  assert.equal(parsed.quantity, 0);
});

test('rejects invalid lead source', () => {
  const parsed = leadCreateSchema.safeParse({
    ...validLead,
    source: 'UNKNOWN',
  });

  assert.equal(parsed.success, false);
});

test('accepts a valid full lead update', () => {
  const parsed = leadUpdateSchema.parse({
    ...validLead,
    status: 'CONTACTED',
    assignedTo: 'Sales Team',
    nextFollowUpDate: '2099-01-02',
  });

  assert.equal(parsed.status, 'CONTACTED');
  assert.equal(parsed.assignedTo, 'Sales Team');
});

test('accepts a valid status update', () => {
  const parsed = leadStatusUpdateSchema.parse({
    status: 'FOLLOW_UP',
    nextFollowUpDate: '2099-01-01',
    note: 'Call again tomorrow.',
  });

  assert.equal(parsed.status, 'FOLLOW_UP');
});

test('rejects a past follow-up date', () => {
  const parsed = leadStatusUpdateSchema.safeParse({
    status: 'FOLLOW_UP',
    nextFollowUpDate: '2020-01-01',
  });

  assert.equal(parsed.success, false);
});

test('rejects invalid status update', () => {
  const parsed = leadStatusUpdateSchema.safeParse({
    status: 'DONE',
  });

  assert.equal(parsed.success, false);
});

test('accepts a valid lead timeline note', () => {
  const parsed = leadActivitySchema.parse({
    note: 'Customer asked for delivery estimate.',
  });

  assert.equal(parsed.note, 'Customer asked for delivery estimate.');
});

test('rejects an empty lead timeline note', () => {
  const parsed = leadActivitySchema.safeParse({
    note: '',
  });

  assert.equal(parsed.success, false);
});

test('accepts import rows with per-row duplicate action', () => {
  const parsed = importCommitSchema.parse({
    duplicateStrategy: 'SKIP',
    rows: [
      {
        ...validLead,
        duplicateAction: 'IMPORT_ANYWAY',
      },
    ],
  });

  assert.equal(parsed.rows[0].duplicateAction, 'IMPORT_ANYWAY');
});

test('normalizes CRM lead export rows with first and last names and missing product fields', () => {
  const csv = [
    '"Leads id","First name","Last name","Phone number","Company name","Assign to","Address","Source","Lead stage"',
    '"LM40825469","Yathwindri","-","+91 9885467799","-","2 - Sakthi Mahendra","","-","New"',
  ].join('\n');
  const [row] = leadImportPrivate.rowsFromCsv(Buffer.from(csv));
  const { mapping } = leadImportPrivate.detectMapping(Object.keys(row));
  const normalized = leadImportPrivate.normalizeRow(row, mapping);
  const parsed = leadCreateSchema.parse(normalized);

  assert.equal(mapping.name, 'First name+Last name');
  assert.equal(parsed.name, 'Yathwindri');
  assert.equal(parsed.phone, '9885467799');
  assert.equal(parsed.company, null);
  assert.equal(parsed.location, 'Not provided');
  assert.equal(parsed.product, 'Not specified');
  assert.equal(parsed.quantity, 0);
  assert.equal(parsed.source, 'CSV_IMPORT');
  assert.equal(parsed.status, 'NEW');
  assert.equal(parsed.assignedTo, '2 - Sakthi Mahendra');
});
