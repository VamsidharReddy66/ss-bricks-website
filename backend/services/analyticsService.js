const { prisma } = require('../config/database');
const { saleStatus, serializeOfflineSale } = require('./offlineSalesService');
const { buildDetailedReports } = require('./analyticsReportBuilder');
const { getBusinessAnalytics } = require('./businessAnalyticsService');

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION']);

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function rangeStart(range, now = new Date()) {
  const today = startOfUtcDay(now);
  if (range === 'LAST_7_DAYS') return new Date(today.getTime() - (6 * DAY_MS));
  if (range === 'LAST_30_DAYS') return new Date(today.getTime() - (29 * DAY_MS));
  if (range === 'LAST_90_DAYS') return new Date(today.getTime() - (89 * DAY_MS));
  if (range === 'LAST_6_MONTHS') {
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  }
  if (range === 'THIS_YEAR') return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  return null;
}

function number(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function quoteSaleRow(lead, productMap) {
  if (lead.finalAmount === null && !lead.payments?.some((payment) => payment.status === 'SUCCESS')) {
    return null;
  }
  const successfulPayments = (lead.payments || []).filter((payment) => payment.status === 'SUCCESS');
  const receivedAmount = successfulPayments.reduce((sum, payment) => sum + number(payment.amount), 0);
  const invoicedAmount = lead.finalAmount === null ? receivedAmount : number(lead.finalAmount);
  const latestPayment = successfulPayments[0] || null;
  const product = productMap.get(lead.product.toLowerCase());

  return {
    id: `quote:${lead.id}`,
    recordId: lead.id,
    type: 'QUOTE',
    saleNumber: lead.enquiryNumber,
    saleDate: lead.paymentEnabledAt || lead.createdAt,
    customerName: lead.customer.name,
    customerPhone: lead.customer.phone,
    location: lead.customer.location,
    product: lead.product,
    quantity: lead.quantity,
    unit: product?.unit || 'unit',
    unitPrice: lead.quantity > 0 ? invoicedAmount / lead.quantity : null,
    invoicedAmount,
    receivedAmount,
    outstandingAmount: Math.max(invoicedAmount - receivedAmount, 0),
    status: saleStatus(invoicedAmount, receivedAmount, lead.status === 'LOST'),
    receivedDate: latestPayment?.updatedAt || null,
    paymentMethod: latestPayment?.paymentMethod || null,
    notes: lead.crmNotes,
    leadStatus: lead.status,
    source: lead.source,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    createdBy: null,
  };
}

function dateWhere(start, field = 'createdAt') {
  return start ? { [field]: { gte: start } } : {};
}

async function loadAnalyticsData(range) {
  const start = rangeStart(range);
  const [allLeads, allOfflineSales, products, activities, priceHistory] = await Promise.all([
    prisma.quoteRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        payments: {
          orderBy: { updatedAt: 'desc' },
          select: {
            amount: true,
            status: true,
            paymentMethod: true,
            failureReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.offlineSale.findMany({
      orderBy: { saleDate: 'desc' },
      include: {
        admin: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      select: {
        name: true,
        standardPrice: true,
        bulkPrice: true,
        bulkQuantity: true,
        unit: true,
        availability: true,
        updatedAt: true,
      },
    }),
    prisma.leadActivity.findMany({
      where: dateWhere(start),
      orderBy: { createdAt: 'desc' },
      select: {
        leadId: true,
        type: true,
        createdAt: true,
        admin: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.priceHistory.findMany({
      where: dateWhere(start, 'updatedAt'),
      orderBy: { updatedAt: 'desc' },
      include: {
        product: {
          select: {
            name: true,
          },
        },
        admin: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const productMap = new Map(products.map((product) => [product.name.toLowerCase(), product]));
  const leads = start
    ? allLeads.filter((lead) => new Date(lead.createdAt) >= start)
    : allLeads;
  const quoteSales = allLeads
    .map((lead) => quoteSaleRow(lead, productMap))
    .filter((sale) => sale && (!start || new Date(sale.saleDate) >= start));
  const manualSales = allOfflineSales
    .filter((sale) => !start || new Date(sale.saleDate) >= start)
    .map(serializeOfflineSale);
  return {
    start,
    allLeads,
    leads,
    products,
    productMap,
    activities,
    priceHistory,
    sales: quoteSales.concat(manualSales).sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate)),
  };
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

function seriesMonths(start, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const first = start
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  const keys = [];
  const cursor = new Date(first);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys.slice(-12);
}

function aggregateAnalytics(data, range, now = new Date()) {
  const { leads, products, productMap, sales } = data;
  const activeLeads = leads.filter((lead) => OPEN_STATUSES.has(lead.status));
  const openPipelineValue = activeLeads.reduce((sum, lead) => {
    if (lead.finalAmount !== null) return sum + number(lead.finalAmount);
    const product = productMap.get(lead.product.toLowerCase());
    return sum + (product ? lead.quantity * number(product.standardPrice) : 0);
  }, 0);

  const activeSales = sales.filter((sale) => sale.status !== 'CANCELLED');
  const invoicedAmount = activeSales.reduce((sum, sale) => sum + sale.invoicedAmount, 0);
  const receivedAmount = activeSales.reduce((sum, sale) => sum + sale.receivedAmount, 0);
  const outstandingAmount = activeSales.reduce((sum, sale) => sum + sale.outstandingAmount, 0);
  const paidSales = activeSales.filter((sale) => sale.status === 'PAID').length;
  const convertedLeadIds = new Set(
    sales.filter((sale) => sale.type === 'QUOTE' && sale.receivedAmount > 0)
      .map((sale) => sale.recordId),
  );
  leads.filter((lead) => lead.status === 'WON').forEach((lead) => convertedLeadIds.add(lead.id));

  const months = seriesMonths(data.start, now);
  const monthData = new Map(months.map((key) => [key, {
    key,
    label: monthLabel(key),
    invoiced: 0,
    received: 0,
  }]));
  activeSales.forEach((sale) => {
    const invoiceMonth = monthData.get(monthKey(sale.saleDate));
    if (invoiceMonth) invoiceMonth.invoiced += sale.invoicedAmount;
    if (sale.receivedAmount > 0) {
      const receivedMonth = monthData.get(monthKey(sale.receivedDate || sale.saleDate));
      if (receivedMonth) receivedMonth.received += sale.receivedAmount;
    }
  });

  const pipelineOrder = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST', 'CLOSED'];
  const pipeline = pipelineOrder.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length,
  }));

  const productPerformance = new Map(products.map((product) => [product.name.toLowerCase(), {
    product: product.name,
    unit: product.unit,
    leads: 0,
    requestedQuantity: 0,
    openPipelineValue: 0,
    sales: 0,
    invoicedAmount: 0,
    receivedAmount: 0,
  }]));
  leads.forEach((lead) => {
    const row = productPerformance.get(lead.product.toLowerCase()) || {
      product: lead.product,
      unit: 'unit',
      leads: 0,
      requestedQuantity: 0,
      openPipelineValue: 0,
      sales: 0,
      invoicedAmount: 0,
      receivedAmount: 0,
    };
    row.leads += 1;
    row.requestedQuantity += lead.quantity;
    if (OPEN_STATUSES.has(lead.status)) {
      const product = productMap.get(lead.product.toLowerCase());
      row.openPipelineValue += lead.finalAmount === null
        ? lead.quantity * number(product?.standardPrice)
        : number(lead.finalAmount);
    }
    productPerformance.set(lead.product.toLowerCase(), row);
  });
  activeSales.forEach((sale) => {
    const row = productPerformance.get(sale.product.toLowerCase()) || {
      product: sale.product,
      unit: sale.unit,
      leads: 0,
      requestedQuantity: 0,
      openPipelineValue: 0,
      sales: 0,
      invoicedAmount: 0,
      receivedAmount: 0,
    };
    row.sales += 1;
    row.invoicedAmount += sale.invoicedAmount;
    row.receivedAmount += sale.receivedAmount;
    productPerformance.set(sale.product.toLowerCase(), row);
  });

  const sources = new Map();
  leads.forEach((lead) => {
    const row = sources.get(lead.source) || { source: lead.source, leads: 0, converted: 0 };
    row.leads += 1;
    if (lead.status === 'WON' || convertedLeadIds.has(lead.id)) row.converted += 1;
    sources.set(lead.source, row);
  });

  const customerBalances = new Map();
  activeSales.filter((sale) => sale.outstandingAmount > 0).forEach((sale) => {
    const key = `${sale.customerName}|${sale.customerPhone || ''}`.toLowerCase();
    const row = customerBalances.get(key) || {
      customerName: sale.customerName,
      phone: sale.customerPhone,
      invoicedAmount: 0,
      receivedAmount: 0,
      outstandingAmount: 0,
    };
    row.invoicedAmount += sale.invoicedAmount;
    row.receivedAmount += sale.receivedAmount;
    row.outstandingAmount += sale.outstandingAmount;
    customerBalances.set(key, row);
  });

  const base = {
    range,
    generatedAt: now,
    metrics: {
      totalLeads: leads.length,
      openPipelineValue,
      salesCount: activeSales.length,
      invoicedAmount,
      receivedAmount,
      outstandingAmount,
      averageOrderValue: activeSales.length ? invoicedAmount / activeSales.length : 0,
      collectionRate: invoicedAmount ? (receivedAmount / invoicedAmount) * 100 : 0,
      paidSales,
      conversionRate: leads.length ? (convertedLeadIds.size / leads.length) * 100 : 0,
    },
    monthlySales: [...monthData.values()],
    leadPipeline: pipeline,
    productPerformance: [...productPerformance.values()]
      .sort((a, b) => b.openPipelineValue + b.invoicedAmount - a.openPipelineValue - a.invoicedAmount),
    sourcePerformance: [...sources.values()]
      .map((source) => ({
        ...source,
        conversionRate: source.leads ? (source.converted / source.leads) * 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads),
    outstandingCustomers: [...customerBalances.values()]
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice(0, 8),
    dataCoverage: {
      leads: leads.length,
      quoteSales: sales.filter((sale) => sale.type === 'QUOTE').length,
      offlineSales: sales.filter((sale) => sale.type === 'OFFLINE').length,
      successfulPayments: leads.reduce(
        (count, lead) => count + lead.payments.filter((payment) => payment.status === 'SUCCESS').length,
        0,
      ),
    },
  };
  return {
    ...base,
    ...buildDetailedReports(data, base, now),
  };
}

async function getAnalytics(query) {
  const business = await getBusinessAnalytics(query.range);
  return {
    range: query.range,
    generatedAt: new Date(),
    scope: 'XLSX_IMPORT_ONLY',
    business,
  };
}

async function listSales(query) {
  const data = await loadAnalyticsData(query.range);
  const search = query.search.toLowerCase();
  const filtered = data.sales.filter((sale) => {
    if (query.type !== 'ALL' && sale.type !== query.type) return false;
    if (query.status !== 'ALL' && sale.status !== query.status) return false;
    if (!search) return true;
    return [
      sale.saleNumber,
      sale.customerName,
      sale.customerPhone,
      sale.location,
      sale.product,
      sale.paymentMethod,
    ].some((value) => String(value || '').toLowerCase().includes(search));
  });
  const totalPages = Math.max(Math.ceil(filtered.length / query.limit), 1);
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;
  return {
    sales: filtered.slice(start, start + query.limit),
    pagination: {
      page,
      limit: query.limit,
      total: filtered.length,
      totalPages,
    },
    totals: filtered.reduce((totals, sale) => ({
      invoicedAmount: totals.invoicedAmount + (sale.status === 'CANCELLED' ? 0 : sale.invoicedAmount),
      receivedAmount: totals.receivedAmount + (sale.status === 'CANCELLED' ? 0 : sale.receivedAmount),
      outstandingAmount: totals.outstandingAmount + (sale.status === 'CANCELLED' ? 0 : sale.outstandingAmount),
    }), {
      invoicedAmount: 0,
      receivedAmount: 0,
      outstandingAmount: 0,
    }),
  };
}

module.exports = {
  _private: {
    aggregateAnalytics,
    monthKey,
    quoteSaleRow,
    rangeStart,
    seriesMonths,
  },
  getAnalytics,
  listSales,
};
