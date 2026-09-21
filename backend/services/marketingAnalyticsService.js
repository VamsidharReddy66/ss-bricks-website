const { prisma } = require('../config/database');

const DAY_MS = 24 * 60 * 60 * 1000;
const WON_STATUSES = new Set(['WON']);
const QUOTED_STATUSES = new Set(['QUOTATION_SENT', 'NEGOTIATION', 'WON']);

function startOfDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function periodFor(range, now = new Date()) {
  const end = new Date(now);
  const today = startOfDay(now);
  let start = null;
  if (range === 'LAST_7_DAYS') start = new Date(today.getTime() - (6 * DAY_MS));
  if (range === 'LAST_30_DAYS') start = new Date(today.getTime() - (29 * DAY_MS));
  if (range === 'LAST_90_DAYS') start = new Date(today.getTime() - (89 * DAY_MS));
  if (range === 'LAST_6_MONTHS') start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  if (range === 'THIS_YEAR') start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  if (!start) return { start: null, end, previousStart: null, previousEnd: null };
  const duration = end.getTime() - start.getTime();
  return {
    start,
    end,
    previousStart: new Date(start.getTime() - duration - 1),
    previousEnd: new Date(start.getTime() - 1),
  };
}

function trend(current, previous, lowerIsBetter = false) {
  if (!previous) return { available: false, value: null, favorable: null };
  const value = ((current - previous) / previous) * 100;
  return { available: true, value, favorable: lowerIsBetter ? value < 0 : value > 0 };
}

function leadSummary(leads) {
  const won = leads.filter((lead) => WON_STATUSES.has(lead.status)).length;
  return {
    enquiries: leads.length,
    won,
    conversionRate: leads.length ? (won / leads.length) * 100 : 0,
  };
}

function bucketKey(value, useDays) {
  const date = new Date(value);
  if (useDays) return date.toISOString().slice(0, 10);
  return date.toISOString().slice(0, 7);
}

function bucketLabel(key, useDays) {
  const date = new Date(`${key}${useDays ? '' : '-01'}T00:00:00.000Z`);
  return date.toLocaleDateString('en-IN', useDays
    ? { day: '2-digit', month: 'short', timeZone: 'UTC' }
    : { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function buildTrend(leads, range, now) {
  const useDays = ['LAST_7_DAYS', 'LAST_30_DAYS'].includes(range);
  const count = useDays ? (range === 'LAST_7_DAYS' ? 7 : 30) : 12;
  const cursor = useDays
    ? startOfDay(new Date(now.getTime() - ((count - 1) * DAY_MS)))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1));
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const key = bucketKey(cursor, useDays);
    rows.push({ key, label: bucketLabel(key, useDays), enquiries: 0, won: 0 });
    if (useDays) cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const map = new Map(rows.map((row) => [row.key, row]));
  leads.forEach((lead) => {
    const row = map.get(bucketKey(lead.createdAt, useDays));
    if (!row) return;
    row.enquiries += 1;
    if (WON_STATUSES.has(lead.status)) row.won += 1;
  });
  return rows;
}

function serializeLead(lead) {
  return {
    id: lead.id,
    enquiryNumber: lead.enquiryNumber,
    date: lead.createdAt,
    customerName: lead.customer.name,
    phone: lead.customer.phone,
    location: lead.customer.location,
    company: lead.company,
    product: lead.product,
    quantity: lead.quantity,
    priority: lead.priority,
    status: lead.status,
    followUp: lead.nextFollowUpDate,
    source: lead.source,
  };
}

async function getMarketingAnalytics(range = 'LAST_30_DAYS') {
  const now = new Date();
  const period = periodFor(range, now);
  const leads = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: true },
  });
  const current = period.start
    ? leads.filter((lead) => lead.createdAt >= period.start && lead.createdAt <= period.end)
    : leads;
  const previous = period.previousStart
    ? leads.filter((lead) => lead.createdAt >= period.previousStart && lead.createdAt <= period.previousEnd)
    : [];
  const currentSummary = leadSummary(current);
  const previousSummary = leadSummary(previous);
  const sources = new Map();
  current.forEach((lead) => sources.set(lead.source, (sources.get(lead.source) || 0) + 1));
  const quoted = current.filter((lead) => QUOTED_STATUSES.has(lead.status)).length;

  return {
    source: 'APPLICATION_LEADS_ONLY',
    generatedAt: now,
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    range,
    period: { start: period.start, end: period.end },
    kpis: {
      enquiries: { value: currentSummary.enquiries, trend: trend(currentSummary.enquiries, previousSummary.enquiries) },
      conversion: { value: currentSummary.conversionRate, numerator: currentSummary.won, denominator: currentSummary.enquiries, trend: trend(currentSummary.conversionRate, previousSummary.conversionRate) },
      costPerLead: { available: false, reason: 'Marketing expense is not recorded in the application database.' },
      marketingSpend: { available: false, reason: 'Campaign and marketing expense records are not available.' },
    },
    leadTrend: buildTrend(current, range, now),
    funnel: [
      { key: 'enquiries', label: 'Enquiries', count: currentSummary.enquiries, available: true },
      { key: 'quotations', label: 'Quotations', count: quoted, available: true, definition: 'Current status is Quotation Sent, Negotiation, or Won.' },
      { key: 'siteVisits', label: 'Site visits', count: null, available: false, reason: 'Site visits are not tracked.' },
      { key: 'orders', label: 'Orders won', count: currentSummary.won, available: true },
    ],
    sources: [...sources.entries()].map(([source, count]) => ({ source, count, percentage: current.length ? (count / current.length) * 100 : 0 })).sort((a, b) => b.count - a.count),
    costPerLeadTrend: { available: false, reason: 'Monthly marketing expense is required to calculate cost per lead.' },
    leads: current.slice(0, 250).map(serializeLead),
  };
}

module.exports = { getMarketingAnalytics };
