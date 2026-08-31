const crypto = require('crypto');
const XLSX = require('xlsx');

const MONTHS = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4],
  ['may', 5], ['june', 6], ['july', 7], ['august', 8],
  ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

const SHEET_ALIASES = {
  expenses: ['monthly factory expenses', 'montly factory expences', 'factory expenses'],
  purchases: ['raw material purchase data', 'raw material purchases'],
  labour: ['labour kuli payments', 'labour payments'],
  production: ['production data', 'production'],
  sales: ['brick sales data', 'sales data'],
  vendors: ['vendors data', 'vendor data'],
  customers: ['customer data', 'customers data'],
  loadAccounts: ['chandu loads accounts', 'load accounts'],
};

const HEADER_ALIASES = {
  date: ['date', 'payment date', 'unloading date'],
  expenseDescription: ['type of expence', 'type of expense', 'description'],
  amount: ['amount', 'payment amount'],
  paymentMode: ['payment mode', 'mode of payment'],
  paidBy: ['payment by', 'paid by', 'payment done by'],
  note: ['note', 'notes'],
  item: ['item', 'material'],
  unitPrice: ['unit price', 'cost per brick'],
  quantity: ['no of units', 'no of bricks', 'no of loads bricks'],
  totalAmount: ['total amount'],
  driverBatta: ['driver barta', 'driver bhatta', 'driver batta'],
  vendor: ['vendor'],
  paidDate: ['paid to vender date', 'paid to vendor date'],
  brickType: ['type of bricks', 'type of brick'],
  brickMakingAmount: ['brick making 2 5 rs per brick'],
  otherPayments: ['other payments'],
  pendingPayments: ['pending payments'],
  producedQuantity: ['no of bricks produced'],
  qualityPricing: ['quality pricing'],
  customerName: ['customer name'],
  location: ['delivery location'],
  invoicedAmount: ['total amount'],
  receivedAmount: ['amount received'],
  receivedDate: ['payment received date'],
  receivedTo: ['received to'],
  phone: ['customers number', 'customer number', 'contact details'],
  productService: ['product service'],
  vendorName: ['vendor name'],
  pricing: ['pricing'],
  address: ['address'],
};

function clean(value) {
  return String(value ?? '').replaceAll('\r', ' ').replaceAll('\n', ' ').trim();
}

function normalized(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalProduct(value) {
  const source = clean(value);
  const key = normalized(source);
  if (!key) return null;
  if (key.includes('paver block')) return 'Paver Blocks';
  if (key.includes('cement block') && key.includes('waste')) return '8-inch Cement Blocks (Waste Blocks)';
  if (key.includes('cement block')) return '8-inch Cement Blocks';
  if (key.includes('partition block')) return 'Partition Blocks';
  if (key === '15 bags sand') return 'Sand (15 bags)';
  return source;
}

function canonicalMaterial(value) {
  const source = clean(value);
  const key = normalized(source);
  if (key === 'cement') return 'Cement';
  if (key === 'dust') return 'Dust';
  if (key === 'black ash') return 'Black Ash';
  return source;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function numeric(value) {
  if (finite(value)) return value;
  if (typeof value !== 'string') return null;
  const candidate = value.replace(/[₹,\s]/g, '');
  if (!candidate || !/^-?\d+(\.\d+)?$/.test(candidate)) return null;
  const result = Number(candidate);
  return Number.isFinite(result) ? result : null;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (finite(value) && value > 30000 && value < 70000) {
    return new Date(Date.UTC(1899, 11, 30) + (value * 86400000));
  }
  const match = clean(value).match(/^(\d{1,2})[-\/]([0-1]?\d)[-\/](\d{2}|\d{4})$/);
  if (!match) return null;
  const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
  const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
  if (
    Number.isNaN(date.getTime())
    || date.getUTCDate() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
  ) return null;
  return date;
}

function isoDate(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function monthMarker(value) {
  return MONTHS.get(normalized(value)) || null;
}

function reportingMonth(year, month) {
  return month ? new Date(Date.UTC(year, month - 1, 1)).toISOString() : null;
}

function rowHash(sheetName, rowNumber, values) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([sheetName, rowNumber, values]))
    .digest('hex');
}

function fileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function issue(code, message, severity = 'WARNING', field = null) {
  return { code, message, severity, field };
}

function rowStatus(issues, imported = true) {
  if (!imported) return 'SKIPPED';
  return issues.length ? 'REVIEW' : 'IMPORTED';
}

function fieldMatches(value, aliases) {
  const key = normalized(value);
  return aliases.some((alias) => key === alias || key.includes(alias));
}

function discoverHeaders(rows, fields, maxRows = 15) {
  let best = { rowIndex: -1, score: 0, indexes: {} };
  rows.slice(0, maxRows).forEach((row, rowIndex) => {
    const indexes = {};
    for (const [field, aliases] of Object.entries(fields)) {
      const columnIndex = row.findIndex((value) => fieldMatches(value, aliases));
      if (columnIndex >= 0) indexes[field] = columnIndex;
    }
    const score = Object.keys(indexes).length;
    if (score > best.score) best = { rowIndex, score, indexes };
  });
  return best;
}

function workbookRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
}

function formulaAt(workbook, sheetName, rowIndex, columnIndex) {
  const sheet = workbook.Sheets[sheetName];
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  return cell?.f || null;
}

function matchingSheet(workbook, aliases) {
  return workbook.SheetNames.find((sheetName) => {
    const key = normalized(sheetName);
    return aliases.some((alias) => key === normalized(alias));
  }) || null;
}

function sourceRow(sheetName, rowIndex, values, status, entityType, issues = []) {
  return {
    sheetName,
    rowNumber: rowIndex + 1,
    rowHash: rowHash(sheetName, rowIndex + 1, values),
    status,
    entityType,
    rawData: values,
    issues,
  };
}

function normalizeDateForSection(value, year, month, issues, field) {
  const date = parseDate(value);
  if (!date) {
    if (clean(value)) issues.push(issue('INVALID_DATE', `${field} could not be parsed.`, 'WARNING', field));
    else issues.push(issue('MISSING_DATE', `${field} is missing; reporting month will be used.`, 'INFO', field));
    return null;
  }
  if (month && date.getUTCFullYear() === year && date.getUTCMonth() + 1 !== month) {
    issues.push(issue(
      'DATE_SECTION_MISMATCH',
      `${field} does not match the worksheet month section and was left unassigned.`,
      'WARNING',
      field,
    ));
    return null;
  }
  return date.toISOString();
}

function deriveReportingYear(fileName) {
  const match = clean(fileName).match(/20\d{2}/);
  return match ? Number(match[0]) : new Date().getUTCFullYear();
}

function parseExpenses(context) {
  const { workbook, sheetName, rows, year, output } = context;
  const header = discoverHeaders(rows, {
    date: HEADER_ALIASES.date,
    description: HEADER_ALIASES.expenseDescription,
    amount: HEADER_ALIASES.amount,
    paymentMode: HEADER_ALIASES.paymentMode,
    paidBy: HEADER_ALIASES.paidBy,
    notes: HEADER_ALIASES.note,
  });
  if (header.score < 3) throw new Error('Expense sheet headers could not be recognized.');
  let month = 1;
  const sourceTotals = [];
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const marker = monthMarker(values[header.indexes.date]);
    if (marker) {
      month = marker;
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'MONTH_MARKER'));
      return;
    }
    const description = clean(values[header.indexes.description]);
    const amount = numeric(values[header.indexes.amount]);
    if (normalized(description) === 'total') {
      sourceTotals.push({ month, amount, rowNumber: rowIndex + 1 });
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_TOTAL'));
      return;
    }
    if (amount === null) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'PRESENTATION_ROW'));
      return;
    }
    if (!description && formulaAt(workbook, sheetName, rowIndex, header.indexes.amount)) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_SUBTOTAL'));
      return;
    }
    const issues = [];
    if (!description) issues.push(issue('MISSING_DESCRIPTION', 'Expense description is missing.', 'WARNING', 'description'));
    const date = normalizeDateForSection(values[header.indexes.date], year, month, issues, 'expenseDate');
    output.expenses.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      expenseDate: date,
      reportingMonth: reportingMonth(year, month),
      category: 'UNCATEGORIZED',
      description: description || null,
      amount,
      paymentMethod: clean(values[header.indexes.paymentMode]) || null,
      paidBy: clean(values[header.indexes.paidBy]) || null,
      notes: clean(values[header.indexes.notes]) || null,
      confidence: 'STATED',
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'EXPENSE', issues));
  });
  output.sourceTotals.expenses = sourceTotals;
}

function parsePurchases(context) {
  const { sheetName, rows, year, output } = context;
  const header = discoverHeaders(rows, {
    date: HEADER_ALIASES.date,
    materialName: HEADER_ALIASES.item,
    unitPrice: HEADER_ALIASES.unitPrice,
    quantity: HEADER_ALIASES.quantity,
    purchaseAmount: HEADER_ALIASES.totalAmount,
    driverBatta: HEADER_ALIASES.driverBatta,
    paidBy: HEADER_ALIASES.paidBy,
    vendorName: HEADER_ALIASES.vendor,
    paidDate: HEADER_ALIASES.paidDate,
    paymentMethod: HEADER_ALIASES.paymentMode,
    notes: HEADER_ALIASES.note,
  });
  if (header.score < 5) throw new Error('Raw-material sheet headers could not be recognized.');
  let month = null;
  const sourceTotals = [];
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const marker = monthMarker(values[header.indexes.date]);
    if (marker) {
      month = marker;
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'MONTH_MARKER'));
      return;
    }
    const materialName = clean(values[header.indexes.materialName]);
    const amount = numeric(values[header.indexes.purchaseAmount]);
    if (normalized(materialName) === 'total') {
      sourceTotals.push({ month, amount, rowNumber: rowIndex + 1 });
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_TOTAL'));
      return;
    }
    if (!materialName || amount === null) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'PRESENTATION_ROW'));
      return;
    }
    const issues = [];
    if (!month) issues.push(issue('MISSING_REPORTING_MONTH', 'Purchase is outside a recognized month section.', 'ERROR'));
    const purchaseDate = normalizeDateForSection(values[header.indexes.date], year, month, issues, 'purchaseDate');
    const rawPaidDate = values[header.indexes.paidDate];
    const paidDate = parseDate(rawPaidDate);
    const explicitlyPending = normalized(rawPaidDate) === 'pending';
    const vendorName = clean(values[header.indexes.vendorName]) || null;
    if (!vendorName) issues.push(issue('MISSING_VENDOR', 'Vendor is missing.', 'WARNING', 'vendorName'));
    output.purchases.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      purchaseDate,
      reportingMonth: reportingMonth(year, month),
      materialName: canonicalMaterial(materialName),
      unitPrice: numeric(values[header.indexes.unitPrice]),
      quantity: numeric(values[header.indexes.quantity]),
      purchaseAmount: amount,
      driverBatta: numeric(values[header.indexes.driverBatta]) || 0,
      vendorName,
      paidDate: paidDate ? paidDate.toISOString() : null,
      paymentStatus: explicitlyPending ? 'PENDING' : paidDate ? 'PAID' : 'UNKNOWN',
      paymentMethod: clean(values[header.indexes.paymentMethod]) || null,
      paidBy: clean(values[header.indexes.paidBy]) || null,
      notes: clean(values[header.indexes.notes]) || null,
      confidence: 'STATED',
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'MATERIAL_PURCHASE', issues));
  });
  output.sourceTotals.purchases = sourceTotals;
}

function parseLabour(context) {
  const { sheetName, rows, year, output } = context;
  const header = discoverHeaders(rows, {
    date: HEADER_ALIASES.date,
    description: HEADER_ALIASES.brickType,
    quantity: HEADER_ALIASES.quantity,
    brickMakingAmount: HEADER_ALIASES.brickMakingAmount,
    otherPayments: HEADER_ALIASES.otherPayments,
    totalAmount: HEADER_ALIASES.amount,
    paymentMode: HEADER_ALIASES.paymentMode,
    paidBy: HEADER_ALIASES.paidBy,
    pendingAmount: HEADER_ALIASES.pendingPayments,
    notes: HEADER_ALIASES.note,
  });
  if (header.score < 5) throw new Error('Labour sheet headers could not be recognized.');
  let month = null;
  const sourceTotals = [];
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const marker = monthMarker(values[header.indexes.date]);
    if (marker) {
      month = marker;
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'MONTH_MARKER'));
      return;
    }
    const description = clean(values[header.indexes.description]);
    const totalAmount = numeric(values[header.indexes.totalAmount]);
    if (normalized(description) === 'total') {
      sourceTotals.push({ month, amount: totalAmount, rowNumber: rowIndex + 1 });
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_TOTAL'));
      return;
    }
    if (!description || totalAmount === null) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'PRESENTATION_ROW'));
      return;
    }
    const issues = [];
    const rawQuantity = values[header.indexes.quantity];
    const quantity = numeric(rawQuantity);
    if (clean(rawQuantity) && quantity === null) {
      issues.push(issue('MIXED_QUANTITY', 'Quantity contains multiple values and requires review.', 'WARNING', 'quantity'));
    }
    const paymentDate = normalizeDateForSection(values[header.indexes.date], year, month, issues, 'paymentDate');
    output.labourPayments.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      paymentDate,
      reportingMonth: reportingMonth(year, month),
      workDescription: description,
      quantity,
      rawQuantity: quantity === null && clean(rawQuantity) ? clean(rawQuantity) : null,
      brickMakingAmount: numeric(values[header.indexes.brickMakingAmount]),
      otherPaymentNote: clean(values[header.indexes.otherPayments]) || null,
      totalAmount,
      pendingAmount: numeric(values[header.indexes.pendingAmount]),
      paymentMethod: clean(values[header.indexes.paymentMode]) || null,
      paidBy: clean(values[header.indexes.paidBy]) || null,
      notes: clean(values[header.indexes.notes]) || null,
      confidence: 'STATED',
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'LABOUR_PAYMENT', issues));
  });
  output.sourceTotals.labour = sourceTotals;
}

function parseProduction(context) {
  const { sheetName, rows, year, output } = context;
  const header = discoverHeaders(rows, {
    date: HEADER_ALIASES.date,
    productName: HEADER_ALIASES.brickType,
    quantity: HEADER_ALIASES.producedQuantity,
    qualityNote: HEADER_ALIASES.qualityPricing,
  });
  if (header.score < 3) throw new Error('Production sheet headers could not be recognized.');
  let month = null;
  let previousDate = null;
  const sourceTotals = [];
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const marker = monthMarker(values[header.indexes.date]);
    if (marker) {
      month = marker;
      previousDate = null;
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'MONTH_MARKER'));
      return;
    }
    const label = clean(values[header.indexes.productName]);
    const labelKey = normalized(label);
    const rawQuantity = values[header.indexes.quantity];
    const quantity = numeric(rawQuantity);
    const parsedDate = parseDate(values[header.indexes.date]);
    if (parsedDate) previousDate = parsedDate;
    if (labelKey.startsWith('total production')) {
      sourceTotals.push({ month, amount: quantity, rowNumber: rowIndex + 1, label });
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_TOTAL'));
      return;
    }
    if (labelKey.startsWith('totals sales') || labelKey === 'available stock') {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'DERIVED_SUMMARY'));
      return;
    }
    let recordType = null;
    let reason = null;
    if (labelKey === 'sunday') recordType = 'SUNDAY';
    else if (labelKey.includes('no production') || normalized(rawQuantity).includes('no production')) {
      recordType = 'NO_PRODUCTION';
      reason = normalized(rawQuantity).includes('no production') ? clean(rawQuantity) : label;
    } else if (quantity !== null && quantity > 0) recordType = 'PRODUCTION';
    if (!recordType) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'PRESENTATION_ROW'));
      return;
    }
    const issues = [];
    let recordDate = parsedDate;
    if (!recordDate && previousDate && recordType === 'PRODUCTION') {
      recordDate = previousDate;
      issues.push(issue('DATE_INHERITED', 'Production date was inherited from the preceding dated row.', 'INFO', 'recordDate'));
    }
    if (!recordDate) issues.push(issue('MISSING_DATE', 'Production date is missing.', 'WARNING', 'recordDate'));
    if (recordType === 'PRODUCTION' && !label) {
      issues.push(issue('MISSING_PRODUCT', 'Produced quantity has no product label.', 'WARNING', 'productName'));
    }
    if (recordType === 'PRODUCTION' && quantity > 2500) {
      issues.push(issue('PRODUCTION_OUTLIER', 'Daily production is unusually high compared with surrounding rows.', 'WARNING', 'quantity'));
    }
    output.production.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      recordDate: recordDate ? recordDate.toISOString() : null,
      reportingMonth: reportingMonth(year, month),
      recordType,
      productName: recordType === 'PRODUCTION' ? canonicalProduct(label) : null,
      quantity: recordType === 'PRODUCTION' ? quantity : null,
      reason,
      qualityNote: clean(values[header.indexes.qualityNote]) || null,
      confidence: 'STATED',
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'PRODUCTION', issues));
  });
  output.sourceTotals.production = sourceTotals;
}

function parseSales(context) {
  const { sheetName, rows, year, output } = context;
  const header = discoverHeaders(rows, {
    date: HEADER_ALIASES.date,
    productName: HEADER_ALIASES.brickType,
    unitPrice: HEADER_ALIASES.unitPrice,
    quantity: HEADER_ALIASES.quantity,
    driverBatta: HEADER_ALIASES.driverBatta,
    customerName: HEADER_ALIASES.customerName,
    location: HEADER_ALIASES.location,
    invoicedAmount: HEADER_ALIASES.invoicedAmount,
    receivedAmount: HEADER_ALIASES.receivedAmount,
    receivedDate: HEADER_ALIASES.receivedDate,
    paymentMethod: HEADER_ALIASES.paymentMode,
    receivedTo: HEADER_ALIASES.receivedTo,
    outstandingAmount: HEADER_ALIASES.pendingPayments,
    notes: HEADER_ALIASES.note,
    phone: HEADER_ALIASES.phone,
  });
  if (header.score < 8) throw new Error('Sales sheet headers could not be recognized.');
  let month = null;
  const sourceTotals = [];
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const marker = monthMarker(values[header.indexes.productName]);
    if (marker) {
      month = marker;
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'MONTH_MARKER'));
      return;
    }
    const productName = clean(values[header.indexes.productName]) || null;
    const productKey = normalized(productName);
    const invoicedAmount = numeric(values[header.indexes.invoicedAmount]);
    const sourceReceived = numeric(values[header.indexes.receivedAmount]);
    const sourceOutstanding = numeric(values[header.indexes.outstandingAmount]);
    const customerName = clean(values[header.indexes.customerName]) || null;
    if (productKey === 'total') {
      sourceTotals.push({
        month,
        quantity: numeric(values[header.indexes.quantity]),
        invoicedAmount,
        receivedAmount: sourceReceived,
        outstandingAmount: sourceOutstanding,
        rowNumber: rowIndex + 1,
      });
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'SOURCE_TOTAL'));
      return;
    }
    if (['target', 'pending', 'working days 30th may'].includes(productKey)) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'TARGET_ROW'));
      return;
    }
    const hasFinancialValue = invoicedAmount !== null || sourceReceived !== null || sourceOutstanding !== null;
    if (!hasFinancialValue || (!productName && !customerName)) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'PRESENTATION_ROW'));
      return;
    }
    const issues = [];
    if (!customerName) issues.push(issue('MISSING_CUSTOMER', 'Sale customer is missing.', 'WARNING', 'customerName'));
    if (!productName) issues.push(issue('MISSING_PRODUCT', 'Sale product is missing.', 'WARNING', 'productName'));
    if (invoicedAmount === null) issues.push(issue('MISSING_INVOICE_AMOUNT', 'Sale invoice amount is missing.', 'ERROR', 'invoicedAmount'));
    if (sourceReceived !== null && invoicedAmount !== null && sourceReceived > invoicedAmount) {
      issues.push(issue('COMBINED_RECEIPT', 'Received amount exceeds this invoice and appears to combine payments.', 'ERROR', 'sourceReceivedAmount'));
    }
    if (sourceOutstanding !== null && invoicedAmount !== null && sourceOutstanding > invoicedAmount) {
      issues.push(issue('CUMULATIVE_OUTSTANDING', 'Outstanding amount exceeds this invoice and appears cumulative.', 'ERROR', 'sourceOutstandingAmount'));
    }
    const saleDate = normalizeDateForSection(values[header.indexes.date], year, month, issues, 'saleDate');
    const phone = clean(values[header.indexes.phone]) || null;
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      issues.push(issue('INVALID_PHONE', 'Customer phone is not a valid 10 digit Indian mobile number.', 'WARNING', 'customerPhone'));
    }
    const sourceKey = `${sheetName}:${rowIndex + 1}`;
    output.sales.push({
      sourceKey,
      saleDate,
      reportingMonth: reportingMonth(year, month),
      customerName: customerName || 'Unknown customer',
      customerPhone: phone,
      location: clean(values[header.indexes.location]) || null,
      productName: canonicalProduct(productName),
      quantity: numeric(values[header.indexes.quantity]),
      quantityUnit: 'load',
      unitPrice: numeric(values[header.indexes.unitPrice]),
      driverBatta: numeric(values[header.indexes.driverBatta]),
      invoicedAmount,
      sourceReceivedAmount: sourceReceived,
      sourceOutstandingAmount: sourceOutstanding,
      paymentMethod: clean(values[header.indexes.paymentMethod]) || null,
      receivedTo: clean(values[header.indexes.receivedTo]) || null,
      notes: clean(values[header.indexes.notes]) || null,
      confidence: issues.some((item) => item.severity === 'ERROR') ? 'REVIEW' : 'STATED',
      issues,
    });

    const rawReceived = normalized(values[header.indexes.receivedAmount]);
    let receiptAmount = sourceReceived;
    let receiptConfidence = 'STATED';
    if (receiptAmount === null && rawReceived === 'received' && invoicedAmount !== null) {
      receiptAmount = invoicedAmount;
      receiptConfidence = 'INFERRED';
      issues.push(issue('INFERRED_RECEIPT', 'Receipt amount was inferred from the word Received.', 'WARNING', 'receivedAmount'));
    }
    if (receiptAmount !== null && receiptAmount > 0) {
      const receiptIssues = [];
      const receiptDate = normalizeDateForSection(
        values[header.indexes.receivedDate],
        year,
        month,
        receiptIssues,
        'receiptDate',
      );
      if (invoicedAmount !== null && receiptAmount > invoicedAmount) {
        receiptConfidence = 'REVIEW';
        receiptIssues.push(issue('UNALLOCATED_COMBINED_RECEIPT', 'Receipt cannot be allocated to one sale without review.', 'ERROR'));
      }
      output.receipts.push({
        sourceKey,
        receiptDate,
        reportingMonth: reportingMonth(year, month),
        customerName: customerName || 'Unknown customer',
        amount: receiptAmount,
        paymentMethod: clean(values[header.indexes.paymentMethod]) || null,
        receivedTo: clean(values[header.indexes.receivedTo]) || null,
        reference: null,
        notes: clean(values[header.indexes.notes]) || null,
        confidence: receiptConfidence,
        issues: receiptIssues,
      });
    }
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'SALE', issues));
  });
  output.sourceTotals.sales = sourceTotals;
}

function parseVendors(context) {
  const { sheetName, rows, output } = context;
  const header = discoverHeaders(rows, {
    productService: HEADER_ALIASES.productService,
    vendorName: HEADER_ALIASES.vendorName,
    phone: HEADER_ALIASES.phone,
    pricingNote: HEADER_ALIASES.pricing,
    address: HEADER_ALIASES.address,
  });
  if (header.score < 3) return;
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const name = clean(values[header.indexes.vendorName]);
    const service = clean(values[header.indexes.productService]);
    if (!name) {
      const issues = service ? [issue('MISSING_VENDOR_NAME', 'Vendor service has no vendor name.', 'WARNING')] : [];
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, issues.length ? 'REVIEW' : 'SKIPPED', 'VENDOR', issues));
      return;
    }
    const phone = clean(values[header.indexes.phone]) || null;
    const issues = phone && !/^[6-9]\d{9}$/.test(phone)
      ? [issue('INVALID_PHONE', 'Vendor phone is invalid.', 'WARNING', 'phone')]
      : [];
    output.vendors.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      displayName: name,
      normalizedName: normalized(name),
      phone,
      address: clean(values[header.indexes.address]) || null,
      productService: service || null,
      pricingNote: clean(values[header.indexes.pricingNote]) || null,
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'VENDOR', issues));
  });
}

function parseCustomers(context) {
  const { sheetName, rows, output } = context;
  const header = discoverHeaders(rows, {
    customerName: HEADER_ALIASES.customerName,
    notes: HEADER_ALIASES.note,
  });
  if (header.score < 1) return;
  rows.forEach((values, rowIndex) => {
    if (rowIndex === header.rowIndex) {
      output.sourceRows.push(sourceRow(sheetName, rowIndex, values, 'SKIPPED', 'HEADER'));
      return;
    }
    const source = clean(values[header.indexes.customerName]);
    if (!source) return;
    const phoneMatches = source.match(/\d+/g) || [];
    const phone = phoneMatches.find((candidate) => candidate.length >= 9) || null;
    const name = source.split(/[-·]/)[0].trim();
    const issues = [];
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      issues.push(issue('INVALID_PHONE', 'Customer reference phone is incomplete or invalid.', 'WARNING', 'phone'));
    }
    output.customers.push({
      sourceKey: `${sheetName}:${rowIndex + 1}`,
      displayName: name,
      normalizedName: normalized(name),
      phone,
      location: null,
      notes: clean(values[header.indexes.notes]) || null,
      issues,
    });
    output.sourceRows.push(sourceRow(sheetName, rowIndex, values, rowStatus(issues), 'CUSTOMER_REFERENCE', issues));
  });
}

function reconciliationEntry(source, normalized, note = null) {
  if (source === null || source === undefined) {
    return { source: null, normalized, analytics: normalized, discrepancy: null, status: 'UNAVAILABLE', note };
  }
  const discrepancy = Number((normalized - source).toFixed(2));
  return {
    source,
    normalized,
    analytics: normalized,
    discrepancy,
    status: Math.abs(discrepancy) < 0.01 ? 'MATCH' : 'MISMATCH',
    note,
  };
}

function sum(records, field) {
  return Number(records.reduce((total, record) => total + (numeric(record[field]) || 0), 0).toFixed(2));
}

function finalize(output, workbook, fileName, hash, year) {
  const sourceExpenseTotal = sum(output.sourceTotals.expenses || [], 'amount');
  const sourcePurchaseSummary = sum(output.sourceTotals.purchases || [], 'amount');
  const sourceLabourTotal = sum(output.sourceTotals.labour || [], 'amount');
  const sourceProductionTotal = sum(output.sourceTotals.production || [], 'amount');
  const sourceSalesTotal = sum(output.sourceTotals.sales || [], 'invoicedAmount');
  const reviewRows = output.sourceRows.filter((row) => row.status === 'REVIEW').length;
  const importedRows = output.sourceRows.filter((row) => row.status === 'IMPORTED').length;
  const reconciliation = {
    salesInvoiced: reconciliationEntry(sourceSalesTotal, sum(output.sales, 'invoicedAmount')),
    factoryExpenses: reconciliationEntry(sourceExpenseTotal, sum(output.expenses, 'amount'), 'Source monthly formulas contain known omissions or subtotal overlap.'),
    rawMaterialPurchases: reconciliationEntry(
      sum(output.purchases, 'purchaseAmount'),
      sum(output.purchases, 'purchaseAmount'),
      `Worksheet summary cells total ${sourcePurchaseSummary.toFixed(2)} and use inconsistent driver-batta treatment.`,
    ),
    labourPayments: reconciliationEntry(sourceLabourTotal, sum(output.labourPayments, 'totalAmount')),
    productionOutput: reconciliationEntry(sourceProductionTotal, sum(output.production.filter((row) => row.recordType === 'PRODUCTION'), 'quantity'), 'June and July source totals omit daily production rows.'),
    collections: reconciliationEntry(null, sum(output.receipts.filter((row) => row.confidence === 'STATED'), 'amount'), 'Historical receipt cells include combined and text-only payments; official collections remain unavailable pending review.'),
    receivables: reconciliationEntry(null, sum(output.sales, 'sourceOutstandingAmount'), 'Historical outstanding cells include cumulative balances and cannot be treated as invoice-level receivables.'),
  };
  return {
    fileName,
    fileHash: hash,
    reportingYear: year,
    sheetsDetected: workbook.SheetNames,
    summary: {
      sourceRows: output.sourceRows.length,
      importedRows,
      reviewRows,
      skippedRows: output.sourceRows.length - importedRows - reviewRows,
      sales: output.sales.length,
      receipts: output.receipts.length,
      expenses: output.expenses.length,
      materialPurchases: output.purchases.length,
      productionRecords: output.production.length,
      labourPayments: output.labourPayments.length,
      vendors: output.vendors.length,
      customerReferences: output.customers.length,
    },
    reconciliation,
    data: output,
  };
}

function parseBusinessWorkbook(buffer, fileName = 'business-data.xlsx') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('A non-empty XLSX file is required.');
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false });
  const year = deriveReportingYear(fileName);
  const output = {
    sourceRows: [],
    sourceTotals: {},
    customers: [],
    vendors: [],
    sales: [],
    receipts: [],
    expenses: [],
    purchases: [],
    production: [],
    labourPayments: [],
  };
  const parsers = {
    expenses: parseExpenses,
    purchases: parsePurchases,
    labour: parseLabour,
    production: parseProduction,
    sales: parseSales,
    vendors: parseVendors,
    customers: parseCustomers,
  };
  for (const [key, parser] of Object.entries(parsers)) {
    const sheetName = matchingSheet(workbook, SHEET_ALIASES[key]);
    if (!sheetName) continue;
    parser({ workbook, sheetName, rows: workbookRows(workbook, sheetName), year, output });
  }
  const auxiliaryName = matchingSheet(workbook, SHEET_ALIASES.loadAccounts);
  if (auxiliaryName) {
    workbookRows(workbook, auxiliaryName).forEach((values, rowIndex) => {
      const issues = [issue(
        'AUXILIARY_OVERLAP',
        'Load-account rows overlap sales/customer balances and are retained for review only.',
        'INFO',
      )];
      output.sourceRows.push(sourceRow(auxiliaryName, rowIndex, values, 'REVIEW', 'AUXILIARY_ACCOUNT', issues));
    });
  }
  return finalize(output, workbook, fileName, fileHash(buffer), year);
}

module.exports = {
  _private: {
    clean,
    canonicalMaterial,
    canonicalProduct,
    discoverHeaders,
    numeric,
    normalized,
    parseDate,
    reconciliationEntry,
  },
  parseBusinessWorkbook,
};
