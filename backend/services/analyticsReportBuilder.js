const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION']);

function number(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function isWithin(value, start) {
  return !start || (value && new Date(value) >= start);
}

function dateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function leadValue(lead, productMap) {
  if (lead.finalAmount !== null && lead.finalAmount !== undefined) return number(lead.finalAmount);
  const product = productMap.get(String(lead.product || '').toLowerCase());
  return product ? number(lead.quantity) * number(product.standardPrice) : 0;
}

function convertedLeadIds(allLeads) {
  return new Set(allLeads.filter((lead) => (
    lead.status === 'WON'
    || (lead.payments || []).some((payment) => payment.status === 'SUCCESS')
  )).map((lead) => lead.id));
}

function buildMarketingReport(data, base, now) {
  const { leads, productMap } = data;
  const converted = convertedLeadIds(leads);
  const today = dateOnly(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const active = leads.filter((lead) => OPEN_STATUSES.has(lead.status));
  const dueToday = active.filter((lead) => (
    lead.nextFollowUpDate
    && new Date(lead.nextFollowUpDate) >= today
    && new Date(lead.nextFollowUpDate) < tomorrow
  ));
  const overdue = active.filter((lead) => lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) < today);
  const future = active.filter((lead) => lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) >= tomorrow);

  const trend = new Map(base.monthlySales.map((month) => [month.key, {
    key: month.key,
    label: month.label,
    leads: 0,
    converted: 0,
  }]));
  leads.forEach((lead) => {
    const date = new Date(lead.createdAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const row = trend.get(key);
    if (!row) return;
    row.leads += 1;
    if (converted.has(lead.id)) row.converted += 1;
  });

  const locations = new Map();
  leads.forEach((lead) => {
    const location = lead.customer?.location || 'Not specified';
    const key = location.toLowerCase();
    const row = locations.get(key) || {
      location,
      leads: 0,
      converted: 0,
      requestedQuantity: 0,
      pipelineValue: 0,
    };
    row.leads += 1;
    row.requestedQuantity += number(lead.quantity);
    if (converted.has(lead.id)) row.converted += 1;
    if (OPEN_STATUSES.has(lead.status)) row.pipelineValue += leadValue(lead, productMap);
    locations.set(key, row);
  });

  const priorities = ['HIGH', 'MEDIUM', 'LOW'].map((priority) => ({
    priority,
    count: leads.filter((lead) => lead.priority === priority).length,
  }));

  return {
    metrics: {
      totalLeads: leads.length,
      newLeads: leads.filter((lead) => lead.status === 'NEW').length,
      activeLeads: active.length,
      convertedLeads: converted.size,
      conversionRate: leads.length ? (converted.size / leads.length) * 100 : 0,
      highPriority: leads.filter((lead) => lead.priority === 'HIGH').length,
      unassigned: active.filter((lead) => !lead.assignedTo).length,
      dueToday: dueToday.length,
      overdueFollowUps: overdue.length,
    },
    leadTrend: [...trend.values()],
    priorityBreakdown: priorities,
    followUpHealth: {
      dueToday: dueToday.length,
      overdue: overdue.length,
      future: future.length,
      unscheduled: active.filter((lead) => !lead.nextFollowUpDate).length,
    },
    locationPerformance: [...locations.values()]
      .map((row) => ({
        ...row,
        conversionRate: row.leads ? (row.converted / row.leads) * 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10),
    dataQuality: {
      zeroQuantity: leads.filter((lead) => number(lead.quantity) === 0).length,
      unspecifiedProduct: leads.filter((lead) => !productMap.has(String(lead.product || '').toLowerCase())).length,
      unassigned: leads.filter((lead) => !lead.assignedTo).length,
      missingFollowUp: active.filter((lead) => !lead.nextFollowUpDate).length,
    },
  };
}

function buildSalesReport(data) {
  const activeSales = data.sales.filter((sale) => sale.status !== 'CANCELLED');
  const statuses = ['PAID', 'PARTIAL', 'OUTSTANDING', 'CANCELLED'].map((status) => ({
    status,
    count: data.sales.filter((sale) => sale.status === status).length,
    amount: data.sales
      .filter((sale) => sale.status === status)
      .reduce((sum, sale) => sum + sale.invoicedAmount, 0),
  }));
  const types = ['QUOTE', 'OFFLINE'].map((type) => ({
    type,
    count: data.sales.filter((sale) => sale.type === type).length,
    invoicedAmount: data.sales
      .filter((sale) => sale.type === type && sale.status !== 'CANCELLED')
      .reduce((sum, sale) => sum + sale.invoicedAmount, 0),
  }));
  const customers = new Map();
  activeSales.forEach((sale) => {
    const key = `${sale.customerName}|${sale.customerPhone || ''}`.toLowerCase();
    const row = customers.get(key) || {
      customerName: sale.customerName,
      phone: sale.customerPhone,
      sales: 0,
      invoicedAmount: 0,
      receivedAmount: 0,
      outstandingAmount: 0,
    };
    row.sales += 1;
    row.invoicedAmount += sale.invoicedAmount;
    row.receivedAmount += sale.receivedAmount;
    row.outstandingAmount += sale.outstandingAmount;
    customers.set(key, row);
  });
  return {
    statusBreakdown: statuses,
    typeBreakdown: types,
    topCustomers: [...customers.values()]
      .sort((a, b) => b.invoicedAmount - a.invoicedAmount)
      .slice(0, 10),
  };
}

function paymentAttempts(data) {
  return data.allLeads.flatMap((lead) => (lead.payments || [])
    .filter((payment) => isWithin(payment.updatedAt, data.start))
    .map((payment) => ({
      ...payment,
      leadId: lead.id,
      enquiryNumber: lead.enquiryNumber,
      customerName: lead.customer?.name || 'Unknown customer',
    })));
}

function buildFinanceReport(data, base, now) {
  const attempts = paymentAttempts(data);
  const activeSales = data.sales.filter((sale) => sale.status !== 'CANCELLED');
  const today = dateOnly(now);
  const agingOrder = [
    { key: 'CURRENT', label: '0-7 days', min: 0, max: 7 },
    { key: 'DUE_30', label: '8-30 days', min: 8, max: 30 },
    { key: 'DUE_60', label: '31-60 days', min: 31, max: 60 },
    { key: 'OVER_60', label: '61+ days', min: 61, max: Infinity },
  ];
  const aging = agingOrder.map((bucket) => ({ ...bucket, records: 0, amount: 0 }));
  activeSales.filter((sale) => sale.outstandingAmount > 0).forEach((sale) => {
    const age = Math.max(Math.floor((today - dateOnly(new Date(sale.saleDate))) / DAY_MS), 0);
    const bucket = aging.find((row) => age >= row.min && age <= row.max);
    if (bucket) {
      bucket.records += 1;
      bucket.amount += sale.outstandingAmount;
    }
  });

  const methodMap = new Map();
  attempts.filter((payment) => payment.status === 'SUCCESS').forEach((payment) => {
    const method = payment.paymentMethod || 'Not specified';
    const row = methodMap.get(method) || { method, records: 0, amount: 0 };
    row.records += 1;
    row.amount += number(payment.amount);
    methodMap.set(method, row);
  });
  activeSales.filter((sale) => sale.type === 'OFFLINE' && sale.receivedAmount > 0).forEach((sale) => {
    const method = sale.paymentMethod || 'Not specified';
    const row = methodMap.get(method) || { method, records: 0, amount: 0 };
    row.records += 1;
    row.amount += sale.receivedAmount;
    methodMap.set(method, row);
  });

  const successfulAttempts = attempts.filter((payment) => payment.status === 'SUCCESS').length;
  const failedAttempts = attempts.filter((payment) => payment.status === 'FAILED').length;
  return {
    metrics: {
      invoicedAmount: base.metrics.invoicedAmount,
      receivedAmount: base.metrics.receivedAmount,
      outstandingAmount: base.metrics.outstandingAmount,
      collectionRate: base.metrics.collectionRate,
      paymentAttempts: attempts.length,
      successfulAttempts,
      failedAttempts,
      failureRate: attempts.length ? (failedAttempts / attempts.length) * 100 : 0,
      refunds: attempts.filter((payment) => payment.status === 'REFUNDED').length,
    },
    paymentStatus: ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map((status) => ({
      status,
      count: attempts.filter((payment) => payment.status === status).length,
      amount: attempts
        .filter((payment) => payment.status === status)
        .reduce((sum, payment) => sum + number(payment.amount), 0),
    })),
    paymentMethods: [...methodMap.values()].sort((a, b) => b.amount - a.amount),
    receivableAging: aging.map(({ key, label, records, amount }) => ({
      key,
      label,
      records,
      amount,
    })),
    recentTransactions: attempts
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map((payment) => ({
        leadId: payment.leadId,
        enquiryNumber: payment.enquiryNumber,
        customerName: payment.customerName,
        amount: number(payment.amount),
        status: payment.status,
        method: payment.paymentMethod,
        failureReason: payment.failureReason,
        updatedAt: payment.updatedAt,
      })),
    dataCoverage: {
      expenseLedger: false,
      costOfProduction: false,
      profitAndLoss: false,
    },
  };
}

function buildOperationsReport(data, base, now) {
  const today = dateOnly(now);
  const inSevenDays = new Date(today.getTime() + (7 * DAY_MS));
  const inThirtyDays = new Date(today.getTime() + (30 * DAY_MS));
  const activeLeads = data.allLeads.filter((lead) => OPEN_STATUSES.has(lead.status));
  const scheduled = activeLeads.filter((lead) => lead.deliveryDate);
  const deliveries = {
    overdue: scheduled.filter((lead) => new Date(lead.deliveryDate) < today).length,
    today: scheduled.filter((lead) => (
      new Date(lead.deliveryDate) >= today
      && new Date(lead.deliveryDate) < new Date(today.getTime() + DAY_MS)
    )).length,
    next7Days: scheduled.filter((lead) => (
      new Date(lead.deliveryDate) > today
      && new Date(lead.deliveryDate) <= inSevenDays
    )).length,
    next30Days: scheduled.filter((lead) => (
      new Date(lead.deliveryDate) > inSevenDays
      && new Date(lead.deliveryDate) <= inThirtyDays
    )).length,
    later: scheduled.filter((lead) => new Date(lead.deliveryDate) > inThirtyDays).length,
    unscheduled: activeLeads.filter((lead) => !lead.deliveryDate).length,
  };

  const productDemand = base.productPerformance.map((row) => {
    const product = data.products.find((item) => item.name.toLowerCase() === row.product.toLowerCase());
    const activeDemand = activeLeads
      .filter((lead) => lead.product.toLowerCase() === row.product.toLowerCase())
      .reduce((sum, lead) => sum + number(lead.quantity), 0);
    return {
      ...row,
      activeDemand,
      availability: product?.availability || 'NOT_CONFIGURED',
      standardPrice: number(product?.standardPrice),
      bulkPrice: number(product?.bulkPrice),
      bulkQuantity: number(product?.bulkQuantity),
      lastPriceUpdate: product?.updatedAt || null,
    };
  });

  const demandTrend = new Map(base.monthlySales.map((month) => [month.key, {
    key: month.key,
    label: month.label,
    leads: 0,
    requestedQuantity: 0,
  }]));
  data.leads.forEach((lead) => {
    const date = new Date(lead.createdAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const row = demandTrend.get(key);
    if (!row) return;
    row.leads += 1;
    row.requestedQuantity += number(lead.quantity);
  });

  const outOfStockNames = new Set(data.products
    .filter((product) => product.availability === 'OUT_OF_STOCK')
    .map((product) => product.name.toLowerCase()));
  const demandOnOutOfStock = activeLeads.filter((lead) => outOfStockNames.has(lead.product.toLowerCase()));

  return {
    metrics: {
      requestedQuantity: data.leads.reduce((sum, lead) => sum + number(lead.quantity), 0),
      configuredProducts: data.products.length,
      inStockProducts: data.products.filter((product) => product.availability === 'IN_STOCK').length,
      outOfStockProducts: outOfStockNames.size,
      scheduledDeliveries: scheduled.length,
      overdueDeliveries: deliveries.overdue,
      demandOnOutOfStock: demandOnOutOfStock.reduce((sum, lead) => sum + number(lead.quantity), 0),
    },
    deliveryHealth: deliveries,
    upcomingDeliveries: scheduled
      .filter((lead) => new Date(lead.deliveryDate) >= today)
      .sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate))
      .slice(0, 10)
      .map((lead) => ({
        leadId: lead.id,
        enquiryNumber: lead.enquiryNumber,
        customerName: lead.customer?.name || 'Unknown customer',
        location: lead.customer?.location || null,
        product: lead.product,
        quantity: lead.quantity,
        deliveryDate: lead.deliveryDate,
        status: lead.status,
      })),
    productDemand,
    demandTrend: [...demandTrend.values()],
    recentPriceChanges: data.priceHistory.slice(0, 10).map((entry) => ({
      product: entry.product?.name || 'Unknown product',
      priceType: entry.priceType,
      oldPrice: number(entry.oldPrice),
      newPrice: number(entry.newPrice),
      updatedAt: entry.updatedAt,
      updatedBy: entry.admin?.name || null,
    })),
    dataCoverage: {
      productionOutput: false,
      rawMaterialUsage: false,
      machineDowntime: false,
      deliveryDates: scheduled.length > 0,
    },
  };
}

function buildTeamReport(data, now) {
  const today = dateOnly(now);
  const converted = convertedLeadIds(data.leads);
  const assignees = new Map();
  data.leads.forEach((lead) => {
    const name = lead.assignedTo || 'Unassigned';
    const row = assignees.get(name.toLowerCase()) || {
      assignee: name,
      leads: 0,
      active: 0,
      highPriority: 0,
      overdueFollowUps: 0,
      converted: 0,
      pipelineValue: 0,
    };
    row.leads += 1;
    if (OPEN_STATUSES.has(lead.status)) {
      row.active += 1;
      row.pipelineValue += leadValue(lead, data.productMap);
    }
    if (lead.priority === 'HIGH') row.highPriority += 1;
    if (converted.has(lead.id)) row.converted += 1;
    if (
      OPEN_STATUSES.has(lead.status)
      && lead.nextFollowUpDate
      && new Date(lead.nextFollowUpDate) < today
    ) {
      row.overdueFollowUps += 1;
    }
    assignees.set(name.toLowerCase(), row);
  });

  const activityMap = new Map();
  data.activities.forEach((activity) => {
    const name = activity.admin?.name || 'Website / System';
    const row = activityMap.get(name.toLowerCase()) || {
      name,
      activities: 0,
      notes: 0,
      statusChanges: 0,
      leadsTouched: new Set(),
    };
    row.activities += 1;
    if (activity.type === 'NOTE') row.notes += 1;
    if (activity.type === 'STATUS_CHANGE') row.statusChanges += 1;
    row.leadsTouched.add(activity.leadId);
    activityMap.set(name.toLowerCase(), row);
  });

  const assignmentRows = [...assignees.values()]
    .map((row) => ({
      ...row,
      conversionRate: row.leads ? (row.converted / row.leads) * 100 : 0,
    }))
    .sort((a, b) => b.active - a.active || b.leads - a.leads);
  return {
    metrics: {
      assignedLeads: data.leads.filter((lead) => lead.assignedTo).length,
      unassignedLeads: data.leads.filter((lead) => !lead.assignedTo).length,
      activeWorkload: data.leads.filter((lead) => OPEN_STATUSES.has(lead.status)).length,
      overdueFollowUps: assignmentRows.reduce((sum, row) => sum + row.overdueFollowUps, 0),
      contributors: activityMap.size,
      recordedActivities: data.activities.length,
    },
    assignmentPerformance: assignmentRows,
    activityPerformance: [...activityMap.values()]
      .map((row) => ({
        name: row.name,
        activities: row.activities,
        notes: row.notes,
        statusChanges: row.statusChanges,
        leadsTouched: row.leadsTouched.size,
      }))
      .sort((a, b) => b.activities - a.activities),
    dataCoverage: {
      assignments: data.leads.some((lead) => lead.assignedTo),
      adminActivities: data.activities.length > 0,
      employeeRoster: false,
      attendance: false,
      payroll: false,
    },
  };
}

function buildInsights(reports, data, base) {
  const insights = [];
  const push = (severity, title, detail, value, target) => {
    insights.push({ severity, title, detail, value, target });
  };
  const { marketing, finance, operations, team } = reports;

  if (marketing.metrics.overdueFollowUps > 0) {
    push(
      'CRITICAL',
      'Overdue lead follow-ups require attention',
      `${marketing.metrics.overdueFollowUps} active lead follow-up${marketing.metrics.overdueFollowUps === 1 ? ' is' : 's are'} past the scheduled date.`,
      marketing.metrics.overdueFollowUps,
      'marketing',
    );
  }
  if (marketing.metrics.unassigned > 0) {
    push(
      'WARNING',
      'Active leads are not assigned',
      `${marketing.metrics.unassigned} active lead${marketing.metrics.unassigned === 1 ? ' has' : 's have'} no owner.`,
      marketing.metrics.unassigned,
      'team',
    );
  }
  if (marketing.dataQuality.unspecifiedProduct > 0) {
    push(
      'WARNING',
      'Imported lead product data needs cleanup',
      `${marketing.dataQuality.unspecifiedProduct} lead${marketing.dataQuality.unspecifiedProduct === 1 ? ' has' : 's have'} a product not matched to the current catalogue.`,
      marketing.dataQuality.unspecifiedProduct,
      'marketing',
    );
  }
  if (marketing.dataQuality.zeroQuantity > 0) {
    push(
      'WARNING',
      'Lead quantities are incomplete',
      `${marketing.dataQuality.zeroQuantity} lead${marketing.dataQuality.zeroQuantity === 1 ? ' has' : 's have'} zero quantity, so pipeline value cannot include those requirements.`,
      marketing.dataQuality.zeroQuantity,
      'marketing',
    );
  }
  if (operations.metrics.overdueDeliveries > 0) {
    push(
      'CRITICAL',
      'Requested delivery dates are overdue',
      `${operations.metrics.overdueDeliveries} active order request${operations.metrics.overdueDeliveries === 1 ? ' has' : 's have'} a delivery date before today.`,
      operations.metrics.overdueDeliveries,
      'operations',
    );
  }
  if (operations.metrics.demandOnOutOfStock > 0) {
    push(
      'CRITICAL',
      'Demand exists for an unavailable product',
      `${operations.metrics.demandOnOutOfStock.toLocaleString('en-IN')} requested units belong to products currently marked out of stock.`,
      operations.metrics.demandOnOutOfStock,
      'operations',
    );
  }
  if (finance.metrics.paymentAttempts > 0 && finance.metrics.failureRate > 0) {
    push(
      'WARNING',
      'Payment attempts are failing',
      `${finance.metrics.failedAttempts} of ${finance.metrics.paymentAttempts} recorded payment attempts failed in this period.`,
      finance.metrics.failureRate,
      'finance',
    );
  }
  if (base.metrics.invoicedAmount > 0 && base.metrics.collectionRate < 80) {
    push(
      'WARNING',
      'Collections trail confirmed sales',
      `${base.metrics.collectionRate.toFixed(1)}% of confirmed sales value has been collected for this period.`,
      base.metrics.outstandingAmount,
      'finance',
    );
  }
  const topSource = base.sourcePerformance[0];
  if (topSource && data.leads.length && (topSource.leads / data.leads.length) >= 0.6) {
    push(
      'INFO',
      'Lead acquisition is concentrated',
      `${topSource.source.replaceAll('_', ' ')} contributes ${((topSource.leads / data.leads.length) * 100).toFixed(1)}% of leads in this period.`,
      topSource.leads,
      'marketing',
    );
  }
  const topProduct = base.productPerformance
    .filter((row) => row.openPipelineValue > 0)
    .sort((a, b) => b.openPipelineValue - a.openPipelineValue)[0];
  if (topProduct) {
    push(
      'OPPORTUNITY',
      `${topProduct.product} leads current pipeline value`,
      `Open enquiries for ${topProduct.product} represent the largest measurable product pipeline.`,
      topProduct.openPipelineValue,
      'operations',
    );
  }
  if (!data.sales.length) {
    push(
      'INFO',
      'No confirmed sales records in this period',
      'Lead demand is available, but confirmed quotation amounts or offline sales have not been recorded.',
      0,
      'sales',
    );
  }
  if (!insights.length) {
    push(
      'INFO',
      'No immediate exceptions detected',
      'Tracked lead, sales, collection, delivery, and assignment indicators have no active exceptions.',
      0,
      'overview',
    );
  }

  const order = { CRITICAL: 0, WARNING: 1, OPPORTUNITY: 2, INFO: 3 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

function buildDetailedReports(data, base, now = new Date()) {
  const marketing = buildMarketingReport(data, base, now);
  const salesReport = buildSalesReport(data);
  const finance = buildFinanceReport(data, base, now);
  const operations = buildOperationsReport(data, base, now);
  const team = buildTeamReport(data, now);
  const reports = {
    marketing,
    salesReport,
    finance,
    operations,
    team,
  };
  return {
    ...reports,
    insights: buildInsights(reports, data, base),
  };
}

module.exports = {
  _private: {
    buildFinanceReport,
    buildInsights,
    buildMarketingReport,
    buildOperationsReport,
    buildSalesReport,
    buildTeamReport,
    convertedLeadIds,
    leadValue,
  },
  buildDetailedReports,
};
