const { prisma } = require('../config/database');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function rangeStart(range, now = new Date()) {
  const today = startOfUtcDay(now);
  if (range === 'LAST_30_DAYS') return new Date(today.getTime() - (29 * DAY_MS));
  if (range === 'LAST_90_DAYS') return new Date(today.getTime() - (89 * DAY_MS));
  if (range === 'LAST_6_MONTHS') return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  if (range === 'THIS_YEAR') return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  return null;
}

function number(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function sum(records, field) {
  return records.reduce((total, record) => total + number(record[field]), 0);
}

function average(records, field) {
  const values = records
    .map((record) => record[field])
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function uniqueCount(records, field) {
  return new Set(records
    .map((record) => String(record[field] || '').trim().toLowerCase())
    .filter(Boolean)).size;
}

function monthKey(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function monthSeries(records, start, now = new Date()) {
  const dated = records.map((record) => record.reportingMonth).filter(Boolean).map((value) => new Date(value));
  let first = start ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)) : null;
  if (!first && dated.length) first = new Date(Math.min(...dated.map((date) => date.getTime())));
  if (!first) first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (dated.length) {
    const latest = new Date(Math.max(...dated.map((date) => date.getTime())));
    if (latest > end) end = latest;
  }
  const keys = [];
  const cursor = new Date(first);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys.slice(-12);
}

function breakdown(records, keyField, valueField, limit = 8) {
  const rows = new Map();
  records.forEach((record) => {
    const name = String(record[keyField] || 'Not specified').trim() || 'Not specified';
    const key = name.toLowerCase();
    const row = rows.get(key) || { name, records: 0, value: 0 };
    row.records += 1;
    if (valueField) row.value += number(record[valueField]);
    rows.set(key, row);
  });
  return [...rows.values()]
    .sort((a, b) => (valueField ? b.value - a.value : b.records - a.records))
    .slice(0, limit);
}

function salesProductBreakdown(records, limit = 8) {
  const rows = new Map();
  records.forEach((record) => {
    const name = String(record.productName || 'Not specified').trim() || 'Not specified';
    const key = name.toLowerCase();
    const row = rows.get(key) || {
      name,
      records: 0,
      value: 0,
      quantity: 0,
      pricedRecords: 0,
      unitPriceTotal: 0,
    };
    row.records += 1;
    row.value += number(record.invoicedAmount);
    row.quantity += number(record.quantity);
    if (record.unitPrice !== null && record.unitPrice !== undefined) {
      row.pricedRecords += 1;
      row.unitPriceTotal += number(record.unitPrice);
    }
    rows.set(key, row);
  });
  return [...rows.values()]
    .map((row) => ({
      name: row.name,
      records: row.records,
      value: row.value,
      quantity: row.quantity,
      averageUnitPrice: row.pricedRecords ? row.unitPriceTotal / row.pricedRecords : null,
      pricedRecords: row.pricedRecords,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function referenceCoverage() {
  return [
    { area: 'Overview', metric: 'Invoiced sales and monthly trend', status: 'SUPPORTED', reason: 'Calculated from normalized workbook sale rows in the selected period.' },
    { area: 'Overview', metric: 'Recorded outflows and composition', status: 'SUPPORTED', reason: 'Uses factory expenses, material purchases, driver batta, and labour obligations.' },
    { area: 'Sales', metric: 'Product, customer, price, and invoice analysis', status: 'SUPPORTED', reason: 'Uses the recorded sale product, customer, unit price, quantity, and invoice fields.' },
    { area: 'Operations', metric: 'Production output and no-production analysis', status: 'SUPPORTED', reason: 'Uses normalized production, Sunday, and no-production rows.' },
    { area: 'Labour', metric: 'Payment obligations and work mix', status: 'SUPPORTED', reason: 'Uses labour payment totals, stated pending values, and work descriptions.' },
    { area: 'Marketing', metric: 'Enquiries, funnel, cost per lead, and spend', status: 'UNAVAILABLE', reason: 'The workbook has no enquiry, campaign, source, quotation-stage, site-visit, or marketing-spend fields.' },
    { area: 'Finance', metric: 'Cash balance, profit, gross margin, and break-even', status: 'UNAVAILABLE', reason: 'The workbook is not a complete accrual ledger and has no cash/bank balances, inventory valuation, or cost-of-goods mapping.' },
    { area: 'Finance', metric: 'Receivables, ageing, and credit-sales ratio', status: 'UNAVAILABLE', reason: 'Receipt and outstanding cells contain combined or cumulative values that are not reliably allocated to individual invoices.' },
    { area: 'Operations', metric: 'Capacity, wastage, downtime, power, and stock', status: 'UNAVAILABLE', reason: 'Installed capacity, rejects, machine hours, meter readings, and inventory balances are not recorded.' },
    { area: 'HR', metric: 'Headcount, attendance, attrition, and performance', status: 'UNAVAILABLE', reason: 'The workbook contains labour payments but no employee roster, attendance, join/exit dates, targets, or named worker output.' },
  ];
}

function dateFilter(start) {
  return start ? { reportingMonth: { gte: start } } : {};
}

function workbookWhere(start) {
  return {
    recordState: 'ACTIVE',
    origin: 'XLSX_IMPORT',
    ...dateFilter(start),
  };
}

function recent(records, dateField, numericFields = []) {
  return [...records]
    .sort((a, b) => new Date(b[dateField] || b.reportingMonth || b.createdAt || 0) - new Date(a[dateField] || a.reportingMonth || a.createdAt || 0))
    .slice(0, 12)
    .map((record) => {
      const row = { ...record };
      numericFields.forEach((field) => {
        row[field] = row[field] === null || row[field] === undefined ? null : Number(row[field]);
      });
      return row;
    });
}

function reconciliationRows(batch) {
  if (!batch?.reconciliation) return [];
  return Object.entries(batch.reconciliation).map(([metric, value]) => ({ metric, ...value }));
}

function buildInsights(report) {
  const insights = [];
  const add = (severity, title, detail, target, department, priority) => insights.push({
    severity,
    title,
    detail,
    target,
    department,
    priority,
  });

  if (report.finance.recordedOutflows > report.sales.invoicedAmount && report.sales.invoicedAmount > 0) {
    const difference = report.finance.recordedOutflows - report.sales.invoicedAmount;
    const excessPercent = (difference / report.sales.invoicedAmount) * 100;
    add(
      excessPercent >= 25 ? 'CRITICAL' : 'WARNING',
      `Recorded outflows are ${excessPercent.toFixed(1)}% above invoiced sales`,
      `The selected period has an INR ${difference.toLocaleString('en-IN')} coverage gap. This compares recorded workbook outflows with invoices and is not net profit or loss. Review the Finance breakdown before making cash commitments.`,
      'finance',
      'Finance',
      10,
    );
  }

  const activeSalesMonths = (report.sales.monthly || []).filter((row) => number(row.invoiced) > 0);
  if (activeSalesMonths.length >= 2) {
    const current = activeSalesMonths[activeSalesMonths.length - 1];
    const previous = activeSalesMonths[activeSalesMonths.length - 2];
    const change = ((number(current.invoiced) - number(previous.invoiced)) / number(previous.invoiced)) * 100;
    if (Math.abs(change) >= 10) {
      const increased = change > 0;
      add(
        increased ? 'OPPORTUNITY' : 'WARNING',
        `Invoiced sales ${increased ? 'increased' : 'decreased'} ${Math.abs(change).toFixed(1)}% in ${current.label}`,
        `${current.label} recorded INR ${number(current.invoiced).toLocaleString('en-IN')} versus INR ${number(previous.invoiced).toLocaleString('en-IN')} in ${previous.label}. This is an invoiced-sales trend, not confirmed cash collection.`,
        'sales',
        'Sales',
        20,
      );
    }
  }

  if (report.operations.pendingPurchases > 0) {
    const pendingValue = number(report.finance.pendingPurchaseValue);
    add(
      'WARNING',
      `${report.operations.pendingPurchases} vendor purchase${report.operations.pendingPurchases === 1 ? '' : 's'} marked pending`,
      `${pendingValue > 0 ? `INR ${pendingValue.toLocaleString('en-IN')} is` : 'These purchases are'} explicitly marked pending in the raw-material register. Confirm payment status before the next purchase cycle.`,
      'finance',
      'Finance',
      30,
    );
  }

  if (report.operations.noProductionDays > 0) {
    const activityRows = number(report.operations.productionLineItems) + number(report.operations.noProductionDays);
    const noProductionRate = activityRows ? (report.operations.noProductionDays / activityRows) * 100 : 0;
    const topReason = report.operations.noProductionReasons?.[0];
    add(
      noProductionRate >= 15 ? 'WARNING' : 'INFO',
      `${report.operations.noProductionDays} no-production rows represent ${noProductionRate.toFixed(1)}% of recorded activity`,
      `${topReason ? `The most frequent recorded reason is ${topReason.name} (${topReason.records} row${topReason.records === 1 ? '' : 's'}). ` : ''}Use the Operations log to review recurring causes; machine downtime is not inferred because hours are absent from the workbook.`,
      'operations',
      'Operations',
      40,
    );
  }

  const topProduct = report.sales.products[0];
  if (topProduct && report.sales.invoicedAmount > 0) {
    const share = (topProduct.value / report.sales.invoicedAmount) * 100;
    if (share >= 70) {
      add(
        'WARNING',
        `${topProduct.name} contributes ${share.toFixed(1)}% of invoiced sales`,
        'Workbook sales are concentrated in one product. Compare production and material plans with this demand concentration before committing capacity.',
        'sales',
        'Sales',
        50,
      );
    }
  }

  if (!report.sales.collectionsAvailable) {
    add(
      'INFO',
      'Historical collections remain unverified',
      'The workbook mixes invoice receipts, combined customer receipts, and text-only statuses. Historical collection rate and receivable aging are intentionally not calculated.',
      'finance',
      'Finance',
      70,
    );
  }

  const mismatch = report.trust.reconciliation.filter((row) => row.status === 'MISMATCH');
  if (mismatch.length) {
    add('WARNING', 'Workbook totals need reconciliation', `${mismatch.length} imported source total${mismatch.length === 1 ? '' : 's'} differ from normalized line items. Analytics uses the line items and exposes the variance.`, 'insights', 'Data Quality', 80);
  }
  if (report.trust.reviewRows > 0) {
    add('WARNING', 'Imported rows need review', `${report.trust.reviewRows} source rows contain missing, conflicting, inferred, or ambiguous values.`, 'insights', 'Data Quality', 90);
  }
  return insights.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

function emptyReport(reason = null) {
  return {
    available: false,
    reason,
    scope: {
      origin: 'XLSX_IMPORT',
      excludesApplicationLeads: true,
      excludesManualRecords: true,
    },
    overview: { monthlyPerformance: [], outflowComposition: [] },
    sales: { records: 0, invoicedAmount: 0, averageInvoiceValue: 0, uniqueCustomers: 0, pricedRecords: 0, collectionsAvailable: false, monthly: [], products: [], customers: [], recent: [] },
    finance: { factoryExpenses: 0, materialPurchases: 0, driverBatta: 0, labourPayments: 0, recordedOutflows: 0, pendingPurchaseValue: 0, receiptReferences: 0, manualLedgerCollections: 0, manualLedgerReceivables: 0, monthly: [], outflowComposition: [], expenses: [], materials: [], vendors: [], purchaseStatuses: [], recentExpenses: [], recentPurchases: [], recentReceipts: [] },
    operations: { productionUnits: 0, productionDays: 0, productionLineItems: 0, averageOutputPerEntry: 0, noProductionDays: 0, sundayRows: 0, pendingPurchases: 0, monthlyProduction: [], monthlyActivity: [], products: [], materials: [], noProductionReasons: [], recentProduction: [] },
    labour: { paymentRecords: 0, paymentObligation: 0, averagePayment: 0, statedPendingAmount: 0, pendingRecords: 0, monthly: [], work: [], paymentMethods: [], paidBy: [], recent: [], employeeMetricsAvailable: false },
    events: [],
    trust: { lastImport: null, sourceRows: 0, reviewRows: 0, summary: null, reconciliation: [] },
    referenceCoverage: referenceCoverage(),
    insights: [],
  };
}

async function getBusinessAnalytics(range, now = new Date()) {
  const start = rangeStart(range, now);
  try {
    const where = workbookWhere(start);
    const [sales, receipts, expenses, purchases, production, labour, latestImport] = await Promise.all([
      prisma.ledgerSale.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { customer: { select: { displayName: true } }, sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.ledgerReceipt.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { customer: { select: { displayName: true } }, sale: { select: { customerName: true } }, sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.expenseEntry.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.materialPurchase.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.productionRecord.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.labourPayment.findMany({ where, orderBy: { reportingMonth: 'asc' }, include: { sourceRow: { select: { sheetName: true, rowNumber: true } } } }),
      prisma.businessImportBatch.findFirst({
        where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } },
        orderBy: { completedAt: 'desc' },
        include: { admin: { select: { name: true } } },
      }),
    ]);

    const normalizedSales = sales.map((sale) => ({
      ...sale,
      customerName: sale.customer?.displayName || sale.customerName,
    }));
    const allRecords = [...normalizedSales, ...expenses, ...purchases, ...production, ...labour];
    const months = monthSeries(allRecords, start, now);
    const monthly = new Map(months.map((key) => [key, {
      key,
      label: monthLabel(key),
      invoiced: 0,
      expenses: 0,
      materials: 0,
      driverBatta: 0,
      labour: 0,
      production: 0,
      productionEntries: 0,
      noProduction: 0,
      sundays: 0,
      labourEntries: 0,
    }]));
    normalizedSales.forEach((row) => { const item = monthly.get(monthKey(row.reportingMonth)); if (item) item.invoiced += number(row.invoicedAmount); });
    expenses.forEach((row) => { const item = monthly.get(monthKey(row.reportingMonth)); if (item) item.expenses += number(row.amount); });
    purchases.forEach((row) => {
      const item = monthly.get(monthKey(row.reportingMonth));
      if (item) { item.materials += number(row.purchaseAmount); item.driverBatta += number(row.driverBatta); }
    });
    labour.forEach((row) => {
      const item = monthly.get(monthKey(row.reportingMonth));
      if (item) { item.labour += number(row.totalAmount); item.labourEntries += 1; }
    });
    production.forEach((row) => {
      const item = monthly.get(monthKey(row.reportingMonth));
      if (!item) return;
      if (row.recordType === 'PRODUCTION') {
        item.production += number(row.quantity);
        item.productionEntries += 1;
      } else if (row.recordType === 'NO_PRODUCTION') item.noProduction += 1;
      else if (row.recordType === 'SUNDAY') item.sundays += 1;
    });

    const monthlyRows = [...monthly.values()].map((row) => ({
      ...row,
      recordedOutflows: row.expenses + row.materials + row.driverBatta + row.labour,
    }));
    const factoryExpenses = sum(expenses, 'amount');
    const materialPurchases = sum(purchases, 'purchaseAmount');
    const driverBatta = sum(purchases, 'driverBatta');
    const labourPayments = sum(labour, 'totalAmount');
    const recordedOutflows = factoryExpenses + materialPurchases + driverBatta + labourPayments;
    const outflowComposition = [
      { name: 'Factory expenses', value: factoryExpenses, records: expenses.length },
      { name: 'Material purchases', value: materialPurchases, records: purchases.length },
      { name: 'Driver batta', value: driverBatta, records: purchases.filter((row) => number(row.driverBatta) > 0).length },
      { name: 'Labour obligations', value: labourPayments, records: labour.length },
    ];
    const productionRows = production.filter((row) => row.recordType === 'PRODUCTION');
    const activeProductionDates = uniqueCount(productionRows.filter((row) => row.recordDate), 'recordDate');
    const salesProducts = salesProductBreakdown(normalizedSales);

    const report = {
      available: true,
      reason: null,
      scope: {
        origin: 'XLSX_IMPORT',
        excludesApplicationLeads: true,
        excludesManualRecords: true,
      },
      overview: {
        monthlyPerformance: monthlyRows.map(({ key, label, invoiced, recordedOutflows: outflows }) => ({
          key,
          label,
          invoiced,
          recordedOutflows: outflows,
        })),
        outflowComposition,
      },
      sales: {
        records: normalizedSales.length,
        invoicedAmount: sum(normalizedSales, 'invoicedAmount'),
        averageInvoiceValue: average(normalizedSales, 'invoicedAmount'),
        uniqueCustomers: uniqueCount(normalizedSales, 'customerName'),
        pricedRecords: normalizedSales.filter((row) => row.unitPrice !== null && row.unitPrice !== undefined).length,
        missingSaleDates: normalizedSales.filter((row) => !row.saleDate).length,
        collectionsAvailable: false,
        confirmedManualReceipts: 0,
        monthly: monthlyRows.map(({ key, label, invoiced }) => ({ key, label, invoiced })),
        products: salesProducts,
        customers: breakdown(normalizedSales, 'customerName', 'invoicedAmount', 10),
        recent: recent(normalizedSales, 'saleDate', ['quantity', 'unitPrice', 'driverBatta', 'invoicedAmount']),
      },
      finance: {
        factoryExpenses,
        materialPurchases,
        driverBatta,
        labourPayments,
        recordedOutflows,
        pendingPurchaseValue: purchases.filter((row) => row.paymentStatus === 'PENDING').reduce((total, row) => total + number(row.purchaseAmount) + number(row.driverBatta), 0),
        receiptReferences: receipts.length,
        monthly: monthlyRows.map(({ key, label, expenses: factory, materials, driverBatta: batta, labour: labourValue, recordedOutflows: total }) => ({ key, label, factory, materials, driverBatta: batta, labour: labourValue, total })),
        outflowComposition,
        expenses: breakdown(expenses, 'description', 'amount'),
        materials: breakdown(purchases, 'materialName', 'purchaseAmount'),
        vendors: breakdown(purchases, 'vendorName', 'purchaseAmount'),
        purchaseStatuses: breakdown(purchases, 'paymentStatus', 'purchaseAmount'),
        recentExpenses: recent(expenses, 'expenseDate', ['amount']),
        recentPurchases: recent(purchases, 'purchaseDate', ['unitPrice', 'quantity', 'purchaseAmount', 'driverBatta']),
        manualLedgerCollections: 0,
        manualLedgerReceivables: 0,
        recentReceipts: recent(receipts.map((receipt) => ({
          ...receipt,
          customerName: receipt.customer?.displayName || receipt.sale?.customerName || 'Not specified',
        })), 'receiptDate', ['amount']),
        profitAvailable: false,
        cashBalanceAvailable: false,
      },
      operations: {
        productionUnits: sum(productionRows, 'quantity'),
        productionDays: activeProductionDates,
        productionLineItems: productionRows.length,
        averageOutputPerEntry: productionRows.length ? sum(productionRows, 'quantity') / productionRows.length : 0,
        noProductionDays: production.filter((row) => row.recordType === 'NO_PRODUCTION').length,
        sundayRows: production.filter((row) => row.recordType === 'SUNDAY').length,
        pendingPurchases: purchases.filter((row) => row.paymentStatus === 'PENDING').length,
        monthlyProduction: monthlyRows.map(({ key, label, production: value }) => ({ key, label, production: value })),
        monthlyActivity: monthlyRows.map(({ key, label, productionEntries, noProduction, sundays }) => ({ key, label, productionEntries, noProduction, sundays })),
        products: breakdown(productionRows, 'productName', 'quantity'),
        materials: breakdown(purchases, 'materialName', 'quantity'),
        noProductionReasons: breakdown(production.filter((row) => row.recordType === 'NO_PRODUCTION'), 'reason', null),
        recentProduction: recent(production, 'recordDate', ['quantity']),
        capacityAvailable: false,
        downtimeHoursAvailable: false,
        stockAvailable: false,
      },
      labour: {
        paymentRecords: labour.length,
        paymentObligation: labourPayments,
        averagePayment: average(labour, 'totalAmount'),
        statedPendingAmount: sum(labour, 'pendingAmount'),
        pendingRecords: labour.filter((row) => number(row.pendingAmount) > 0).length,
        monthly: monthlyRows.map(({ key, label, labour: amount, labourEntries: records }) => ({ key, label, amount, records })),
        work: breakdown(labour, 'workDescription', 'totalAmount'),
        paymentMethods: breakdown(labour, 'paymentMethod', 'totalAmount'),
        paidBy: breakdown(labour, 'paidBy', 'totalAmount'),
        recent: recent(labour, 'paymentDate', ['quantity', 'brickMakingAmount', 'totalAmount', 'pendingAmount']),
        employeeMetricsAvailable: false,
      },
      events: [],
      trust: {
        lastImport: latestImport ? {
          id: latestImport.id,
          fileName: latestImport.fileName,
          status: latestImport.status,
          reportingYear: latestImport.reportingYear,
          importedAt: latestImport.completedAt || latestImport.createdAt,
          importedBy: latestImport.admin?.name || null,
        } : null,
        sourceRows: number(latestImport?.summary?.sourceRows),
        reviewRows: number(latestImport?.summary?.reviewRows),
        summary: latestImport?.summary || null,
        reconciliation: reconciliationRows(latestImport),
      },
      referenceCoverage: referenceCoverage(),
    };
    report.insights = buildInsights(report);
    return report;
  } catch (error) {
    if (['P2021', 'P2022'].includes(error.code)) {
      return emptyReport('Run the business analytics database migration before importing the workbook.');
    }
    throw error;
  }
}

module.exports = {
  __private: {
    average,
    breakdown,
    buildInsights,
    monthKey,
    monthSeries,
    rangeStart,
    referenceCoverage,
    salesProductBreakdown,
    uniqueCount,
    workbookWhere,
  },
  emptyReport,
  getBusinessAnalytics,
};
