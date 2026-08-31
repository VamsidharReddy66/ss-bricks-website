const { prisma } = require('../config/database');
const { parseBusinessWorkbook } = require('./businessWorkbookParser');

const VALID_PHONE = /^[6-9]\d{9}$/;

function httpError(statusCode, message, field = 'file') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.field = field;
  return error;
}

function normalizeIdentity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceKey(sheetName, rowNumber) {
  return `${sheetName}:${rowNumber}`;
}

function compactPreview(parsed, existingBatch = null) {
  const reviewSamples = parsed.data.sourceRows
    .filter((row) => row.status === 'REVIEW')
    .slice(0, 20)
    .map((row) => ({
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      entityType: row.entityType,
      issues: row.issues,
    }));

  return {
    fileName: parsed.fileName,
    fileHash: parsed.fileHash,
    reportingYear: parsed.reportingYear,
    sheetsDetected: parsed.sheetsDetected,
    summary: parsed.summary,
    reconciliation: parsed.reconciliation,
    reviewSamples,
    duplicateImport: existingBatch
      ? {
        id: existingBatch.id,
        status: existingBatch.status,
        importedAt: existingBatch.completedAt || existingBatch.createdAt,
      }
      : null,
  };
}

async function previewBusinessWorkbook(file) {
  if (!file?.buffer?.length) throw httpError(400, 'Upload a non-empty XLSX workbook.');
  if (!String(file.originalname || '').toLowerCase().endsWith('.xlsx')) {
    throw httpError(400, 'Business analytics import accepts XLSX workbooks only.');
  }

  const parsed = parseBusinessWorkbook(file.buffer, file.originalname);
  const existingBatch = await prisma.businessImportBatch.findUnique({
    where: { fileHash: parsed.fileHash },
    select: { id: true, status: true, createdAt: true, completedAt: true },
  });
  return compactPreview(parsed, existingBatch);
}

async function customerLookup(tx, parsed) {
  const candidates = [
    ...parsed.data.customers.map((customer) => ({
      displayName: customer.displayName,
      normalizedName: customer.normalizedName,
      phone: customer.phone,
      location: customer.location,
      notes: customer.notes,
    })),
    ...parsed.data.sales.map((sale) => ({
      displayName: sale.customerName,
      normalizedName: normalizeIdentity(sale.customerName),
      phone: sale.customerPhone,
      location: sale.location,
      notes: null,
    })),
  ].filter((candidate) => candidate.normalizedName && candidate.normalizedName !== 'unknown customer');

  const lookup = new Map();
  for (const candidate of candidates) {
    const validPhone = VALID_PHONE.test(candidate.phone || '') ? candidate.phone : null;
    const key = validPhone ? `phone:${validPhone}` : `name:${candidate.normalizedName}`;
    if (lookup.has(key)) continue;

    const existing = await tx.ledgerCustomer.findFirst({
      where: validPhone
        ? { phone: validPhone }
        : { normalizedName: candidate.normalizedName },
      orderBy: { id: 'asc' },
    });
    const customer = existing || await tx.ledgerCustomer.create({
      data: {
        displayName: candidate.displayName,
        normalizedName: candidate.normalizedName,
        phone: validPhone,
        location: candidate.location || null,
        notes: candidate.notes || null,
      },
    });
    lookup.set(key, customer.id);
    if (!lookup.has(`name:${candidate.normalizedName}`)) {
      lookup.set(`name:${candidate.normalizedName}`, customer.id);
    }
  }
  return lookup;
}

function customerIdFor(lookup, name, phone) {
  const validPhone = VALID_PHONE.test(phone || '') ? phone : null;
  return (validPhone && lookup.get(`phone:${validPhone}`))
    || lookup.get(`name:${normalizeIdentity(name)}`)
    || null;
}

async function vendorLookup(tx, parsed) {
  const candidates = [
    ...parsed.data.vendors,
    ...parsed.data.purchases
      .filter((purchase) => purchase.vendorName)
      .map((purchase) => ({
        displayName: purchase.vendorName,
        normalizedName: normalizeIdentity(purchase.vendorName),
        phone: null,
        address: null,
        productService: purchase.materialName,
        pricingNote: null,
      })),
  ];
  const lookup = new Map();
  for (const candidate of candidates) {
    const key = normalizeIdentity(candidate.normalizedName || candidate.displayName);
    if (!key || lookup.has(key)) continue;
    const existing = await tx.businessVendor.findFirst({
      where: { normalizedName: key },
      orderBy: { id: 'asc' },
    });
    const vendor = existing || await tx.businessVendor.create({
      data: {
        displayName: candidate.displayName,
        normalizedName: key,
        phone: VALID_PHONE.test(candidate.phone || '') ? candidate.phone : null,
        address: candidate.address || null,
        productService: candidate.productService || null,
        pricingNote: candidate.pricingNote || null,
      },
    });
    lookup.set(key, vendor.id);
  }
  return lookup;
}

function importedRecord(record, sourceRows, adminId) {
  return {
    origin: 'XLSX_IMPORT',
    confidence: record.confidence || 'STATED',
    sourceRowId: sourceRows.get(record.sourceKey) || null,
    createdBy: adminId,
  };
}

function businessSummary(parsed, batchId) {
  return {
    batchId,
    ...parsed.summary,
    reportingYear: parsed.reportingYear,
    fileHash: parsed.fileHash,
    status: parsed.summary.reviewRows > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
  };
}

async function commitBusinessWorkbook(file, adminId) {
  if (!file?.buffer?.length) throw httpError(400, 'Upload the XLSX workbook to import.');
  if (!String(file.originalname || '').toLowerCase().endsWith('.xlsx')) {
    throw httpError(400, 'Business analytics import accepts XLSX workbooks only.');
  }
  const parsed = parseBusinessWorkbook(file.buffer, file.originalname);
  const existing = await prisma.businessImportBatch.findUnique({
    where: { fileHash: parsed.fileHash },
    select: { id: true, status: true },
  });
  if (existing) {
    throw httpError(409, `This exact workbook was already imported in batch ${existing.id}.`, 'fileHash');
  }

  return prisma.$transaction(async (tx) => {
    const batch = await tx.businessImportBatch.create({
      data: {
        fileName: parsed.fileName,
        fileHash: parsed.fileHash,
        reportingYear: parsed.reportingYear,
        importedBy: adminId,
        summary: parsed.summary,
        reconciliation: parsed.reconciliation,
      },
    });

    await tx.businessImportRow.createMany({
      data: parsed.data.sourceRows.map((row) => ({
        batchId: batch.id,
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        rowHash: row.rowHash,
        status: row.status,
        entityType: row.entityType,
        rawData: row.rawData,
        issues: row.issues,
      })),
    });
    const storedRows = await tx.businessImportRow.findMany({
      where: { batchId: batch.id },
      select: { id: true, sheetName: true, rowNumber: true },
    });
    const sourceRows = new Map(storedRows.map((row) => [sourceKey(row.sheetName, row.rowNumber), row.id]));
    const customers = await customerLookup(tx, parsed);
    const vendors = await vendorLookup(tx, parsed);

    await tx.ledgerSale.createMany({
      data: parsed.data.sales.map((sale) => ({
        saleDate: sale.saleDate,
        reportingMonth: sale.reportingMonth,
        customerId: customerIdFor(customers, sale.customerName, sale.customerPhone),
        customerName: sale.customerName,
        customerPhone: VALID_PHONE.test(sale.customerPhone || '') ? sale.customerPhone : null,
        location: sale.location,
        productName: sale.productName,
        quantity: sale.quantity,
        quantityUnit: sale.quantityUnit,
        unitPrice: sale.unitPrice,
        driverBatta: sale.driverBatta,
        invoicedAmount: sale.invoicedAmount,
        sourceReceivedAmount: sale.sourceReceivedAmount,
        sourceOutstandingAmount: sale.sourceOutstandingAmount,
        paymentMethod: sale.paymentMethod,
        receivedTo: sale.receivedTo,
        notes: sale.notes,
        ...importedRecord(sale, sourceRows, adminId),
      })),
    });
    const sales = await tx.ledgerSale.findMany({
      where: { sourceRowId: { in: parsed.data.sales.map((sale) => sourceRows.get(sale.sourceKey)).filter(Boolean) } },
      select: { id: true, sourceRowId: true, invoicedAmount: true },
    });
    const salesBySource = new Map(sales.map((sale) => [sale.sourceRowId, sale]));

    await tx.ledgerReceipt.createMany({
      data: parsed.data.receipts.map((receipt) => {
        const rowId = sourceRows.get(receipt.sourceKey) || null;
        const sale = salesBySource.get(rowId);
        const canAllocate = sale
          && receipt.confidence !== 'REVIEW'
          && Number(receipt.amount) <= Number(sale.invoicedAmount || 0);
        return {
          receiptDate: receipt.receiptDate,
          reportingMonth: receipt.reportingMonth,
          customerId: customerIdFor(customers, receipt.customerName, null),
          saleId: canAllocate ? sale.id : null,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          receivedTo: receipt.receivedTo,
          reference: receipt.reference,
          notes: receipt.notes,
          ...importedRecord(receipt, sourceRows, adminId),
        };
      }),
    });
    await tx.expenseEntry.createMany({
      data: parsed.data.expenses.map((expense) => ({
        expenseDate: expense.expenseDate,
        reportingMonth: expense.reportingMonth,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        paidBy: expense.paidBy,
        notes: expense.notes,
        ...importedRecord(expense, sourceRows, adminId),
      })),
    });
    await tx.materialPurchase.createMany({
      data: parsed.data.purchases.map((purchase) => ({
        purchaseDate: purchase.purchaseDate,
        reportingMonth: purchase.reportingMonth,
        materialName: purchase.materialName,
        unitPrice: purchase.unitPrice,
        quantity: purchase.quantity,
        purchaseAmount: purchase.purchaseAmount,
        driverBatta: purchase.driverBatta,
        vendorId: purchase.vendorName ? vendors.get(normalizeIdentity(purchase.vendorName)) || null : null,
        vendorName: purchase.vendorName,
        paidDate: purchase.paidDate,
        paymentStatus: purchase.paymentStatus,
        paymentMethod: purchase.paymentMethod,
        paidBy: purchase.paidBy,
        notes: purchase.notes,
        ...importedRecord(purchase, sourceRows, adminId),
      })),
    });
    await tx.productionRecord.createMany({
      data: parsed.data.production.map((record) => ({
        recordDate: record.recordDate,
        reportingMonth: record.reportingMonth,
        recordType: record.recordType,
        productName: record.productName,
        quantity: record.quantity,
        reason: record.reason,
        qualityNote: record.qualityNote,
        ...importedRecord(record, sourceRows, adminId),
      })),
    });
    await tx.labourPayment.createMany({
      data: parsed.data.labourPayments.map((payment) => ({
        paymentDate: payment.paymentDate,
        reportingMonth: payment.reportingMonth,
        workDescription: payment.workDescription,
        quantity: payment.quantity,
        rawQuantity: payment.rawQuantity,
        brickMakingAmount: payment.brickMakingAmount,
        otherPaymentNote: payment.otherPaymentNote,
        totalAmount: payment.totalAmount,
        pendingAmount: payment.pendingAmount,
        paymentMethod: payment.paymentMethod,
        paidBy: payment.paidBy,
        notes: payment.notes,
        ...importedRecord(payment, sourceRows, adminId),
      })),
    });

    const status = parsed.summary.reviewRows > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';
    await tx.businessImportBatch.update({
      where: { id: batch.id },
      data: { status, completedAt: new Date() },
    });
    const summary = businessSummary(parsed, batch.id);
    await tx.businessAuditLog.create({
      data: {
        entityType: 'BUSINESS_IMPORT_BATCH',
        entityId: String(batch.id),
        action: 'IMPORT',
        reason: `Imported ${parsed.fileName}`,
        afterData: { summary, reconciliation: parsed.reconciliation },
        createdBy: adminId,
      },
    });
    return { summary, reconciliation: parsed.reconciliation };
  }, { timeout: 30000 });
}

async function listBusinessImports() {
  return prisma.businessImportBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      fileName: true,
      fileHash: true,
      status: true,
      reportingYear: true,
      summary: true,
      reconciliation: true,
      createdAt: true,
      completedAt: true,
      admin: { select: { name: true } },
    },
  });
}

module.exports = {
  __private: { compactPreview, customerIdFor, normalizeIdentity },
  commitBusinessWorkbook,
  listBusinessImports,
  previewBusinessWorkbook,
};
