const { prisma } = require('../config/database');
const { parseDateOnly } = require('../utils/date');

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const CONFIG = {
  sales: {
    model: 'ledgerSale',
    dateField: 'saleDate',
    searchFields: ['customerName', 'customerPhone', 'location', 'productName', 'notes'],
    numericFields: ['quantity', 'unitPrice', 'driverBatta', 'invoicedAmount', 'sourceReceivedAmount', 'sourceOutstandingAmount'],
  },
  receipts: {
    model: 'ledgerReceipt',
    dateField: 'receiptDate',
    searchFields: ['paymentMethod', 'receivedTo', 'reference', 'notes'],
    numericFields: ['amount'],
  },
  expenses: {
    model: 'expenseEntry',
    dateField: 'expenseDate',
    searchFields: ['category', 'description', 'paymentMethod', 'paidBy', 'notes'],
    numericFields: ['amount'],
  },
  purchases: {
    model: 'materialPurchase',
    dateField: 'purchaseDate',
    searchFields: ['materialName', 'vendorName', 'paymentStatus', 'paymentMethod', 'paidBy', 'notes'],
    numericFields: ['unitPrice', 'quantity', 'purchaseAmount', 'driverBatta'],
  },
  production: {
    model: 'productionRecord',
    dateField: 'recordDate',
    searchFields: ['productName', 'reason', 'qualityNote'],
    numericFields: ['quantity'],
  },
  labour: {
    model: 'labourPayment',
    dateField: 'paymentDate',
    searchFields: ['workDescription', 'rawQuantity', 'otherPaymentNote', 'paymentMethod', 'paidBy', 'notes'],
    numericFields: ['quantity', 'brickMakingAmount', 'totalAmount', 'pendingAmount'],
  },
  events: {
    model: 'businessEvent',
    dateField: 'occurredAt',
    searchFields: ['category', 'description', 'relatedEntityType', 'relatedEntityId'],
    numericFields: ['amount'],
    isEvent: true,
  },
};

function configFor(type) {
  const config = CONFIG[type];
  if (!config) {
    const error = new Error('Unsupported business record type.');
    error.statusCode = 404;
    throw error;
  }
  return config;
}

function reportingMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function rangeStart(range, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === 'LAST_30_DAYS') return new Date(today.getTime() - (29 * 86400000));
  if (range === 'LAST_90_DAYS') return new Date(today.getTime() - (89 * 86400000));
  if (range === 'LAST_6_MONTHS') return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  if (range === 'THIS_YEAR') return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  return null;
}

function serialize(config, record) {
  const output = { ...record };
  config.numericFields.forEach((field) => {
    output[field] = output[field] === null || output[field] === undefined ? null : Number(output[field]);
  });
  if (config.model === 'ledgerReceipt') {
    output.customerName = record.customer?.displayName || record.sale?.customerName || null;
  }
  return output;
}

function auditSnapshot(config, record) {
  return JSON.parse(JSON.stringify(serialize(config, record)));
}

function prepareData(type, payload, adminId, creating = false) {
  const config = configFor(type);
  if (config.isEvent) {
    return { ...payload, ...(creating ? { createdBy: adminId } : {}) };
  }
  const date = parseDateOnly(payload[config.dateField]);
  const data = {
    ...payload,
    [config.dateField]: date,
    reportingMonth: reportingMonth(date),
  };
  if (type === 'receipts') delete data.customerName;
  if (creating) Object.assign(data, { origin: 'MANUAL', confidence: 'CONFIRMED', createdBy: adminId });
  return data;
}

async function prepareReceiptData(tx, payload, adminId, creating = false) {
  const receiptDate = parseDateOnly(payload.receiptDate);
  let sale = null;
  let customerId = null;
  if (payload.saleId) {
    sale = await tx.ledgerSale.findFirst({
      where: { id: payload.saleId, recordState: 'ACTIVE' },
      select: { id: true, customerId: true, customerName: true },
    });
    if (!sale) {
      const error = new Error('Linked ledger sale was not found or is voided.');
      error.statusCode = 400;
      error.field = 'saleId';
      throw error;
    }
    customerId = sale.customerId;
  }
  if (!customerId && payload.customerName) {
    const normalizedName = normalizeIdentity(payload.customerName);
    let customer = await tx.ledgerCustomer.findFirst({
      where: { normalizedName },
      orderBy: { id: 'asc' },
    });
    if (!customer) {
      customer = await tx.ledgerCustomer.create({
        data: { displayName: payload.customerName, normalizedName },
      });
    }
    customerId = customer.id;
  }
  return {
    receiptDate,
    reportingMonth: reportingMonth(receiptDate),
    saleId: sale?.id || null,
    customerId,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    receivedTo: payload.receivedTo,
    reference: payload.reference,
    notes: payload.notes,
    ...(creating ? { origin: 'MANUAL', confidence: 'CONFIRMED', createdBy: adminId } : {}),
  };
}

function recordWhere(type, config, query) {
  const where = {};
  if (config.isEvent && query.state === 'ACTIVE') where.status = { not: 'ARCHIVED' };
  if (config.isEvent && query.state === 'VOIDED') where.status = 'ARCHIVED';
  if (!config.isEvent && query.state !== 'ALL') where.recordState = query.state;
  if (!config.isEvent && query.origin && query.origin !== 'ALL') where.origin = query.origin;
  if (query.search) {
    where.OR = config.searchFields.map((field) => ({
      [field]: { contains: query.search, mode: 'insensitive' },
    }));
    if (type === 'receipts') {
      where.OR.push(
        { customer: { displayName: { contains: query.search, mode: 'insensitive' } } },
        { sale: { customerName: { contains: query.search, mode: 'insensitive' } } },
      );
    }
  }
  const start = rangeStart(query.range);
  if (start) where[config.isEvent ? 'occurredAt' : 'reportingMonth'] = { gte: start };
  return where;
}

async function listRecords(type, query) {
  const config = configFor(type);
  const model = prisma[config.model];
  const where = recordWhere(type, config, query);
  const [records, total] = await Promise.all([
    model.findMany({
      where,
      orderBy: config.isEvent
        ? [{ occurredAt: 'desc' }, { id: 'desc' }]
        : [{ reportingMonth: 'desc' }, { [config.dateField]: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: config.isEvent
        ? { admin: { select: { name: true } } }
        : {
          admin: { select: { name: true } },
          sourceRow: { select: { sheetName: true, rowNumber: true } },
          ...(type === 'receipts' ? { customer: { select: { displayName: true } }, sale: { select: { customerName: true } } } : {}),
        },
    }),
    model.count({ where }),
  ]);
  return {
    records: records.map((record) => serialize(config, record)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(Math.ceil(total / query.limit), 1),
    },
  };
}

async function findRecord(tx, type, id) {
  const config = configFor(type);
  const record = await tx[config.model].findUnique({ where: { id } });
  if (!record) {
    const error = new Error('Business record not found.');
    error.statusCode = 404;
    throw error;
  }
  return { config, record };
}

async function createRecord(type, payload, adminId) {
  const config = configFor(type);
  return prisma.$transaction(async (tx) => {
    const data = type === 'receipts'
      ? await prepareReceiptData(tx, payload, adminId, true)
      : prepareData(type, payload, adminId, true);
    const record = await tx[config.model].create({ data });
    await tx.businessAuditLog.create({
      data: {
        entityType: type.toUpperCase(),
        entityId: String(record.id),
        action: 'CREATE',
        afterData: auditSnapshot(config, record),
        createdBy: adminId,
      },
    });
    return serialize(config, record);
  });
}

async function updateRecord(type, id, payload, reason, adminId) {
  return prisma.$transaction(async (tx) => {
    const { config, record: before } = await findRecord(tx, type, id);
    const data = type === 'receipts'
      ? await prepareReceiptData(tx, payload, adminId, false)
      : prepareData(type, payload, adminId, false);
    const record = await tx[config.model].update({
      where: { id },
      data,
    });
    await tx.businessAuditLog.create({
      data: {
        entityType: type.toUpperCase(),
        entityId: String(id),
        action: 'UPDATE',
        reason,
        beforeData: auditSnapshot(config, before),
        afterData: auditSnapshot(config, record),
        createdBy: adminId,
      },
    });
    return serialize(config, record);
  });
}

async function voidRecord(type, id, reason, adminId) {
  return prisma.$transaction(async (tx) => {
    const { config, record: before } = await findRecord(tx, type, id);
    const data = config.isEvent
      ? { status: 'ARCHIVED' }
      : { recordState: 'VOIDED', voidedAt: new Date() };
    const record = await tx[config.model].update({ where: { id }, data });
    await tx.businessAuditLog.create({
      data: {
        entityType: type.toUpperCase(),
        entityId: String(id),
        action: 'VOID',
        reason,
        beforeData: auditSnapshot(config, before),
        afterData: auditSnapshot(config, record),
        createdBy: adminId,
      },
    });
    return serialize(config, record);
  });
}

module.exports = {
  __private: { prepareData, reportingMonth, serialize },
  createRecord,
  listRecords,
  updateRecord,
  voidRecord,
};
