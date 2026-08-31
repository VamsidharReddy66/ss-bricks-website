# SS Bricks Business Analytics

## Architecture

```text
XLSX workbook
  -> preview, clean, normalize and reconcile
  -> PostgreSQL business ledger and source-row audit trail
  -> deterministic analytics services
  -> Admin Portal KPIs, charts, insights and logs

Admin Portal correction/void of an imported row
  -> PostgreSQL business ledger and audit log
  -> XLSX-scoped deterministic analytics services
  -> refreshed Admin Portal
```

The workbook is an ingestion source, not a runtime database. After commit, analytics does not
read Excel. Imported records retain their batch, sheet and row references, while manual
records retain the administrator responsible for creation and correction.

## Current Analytics Scope

The Analytics KPIs, charts, and insights are currently **XLSX-import only** and are filtered
to active records with `origin = XLSX_IMPORT`. The searchable operational logs can show
workbook rows and manually added admin rows together or filter either source explicitly.
Manual rows are labeled `MANUAL` and do not change workbook-only KPIs, charts, or insights.

The following application data is deliberately excluded from Analytics for this phase:

- Website quotation leads
- CSV/Excel lead imports from the Leads workflow
- Manually created CRM leads
- Application payment and delivery activity
- Offline sales from the application Sales workflow
- CRM assignments, follow-ups, and administrator activity

Those records remain available in their existing Leads and sales workflows and are not
deleted. Manually added business-log rows remain available in their respective operational
logs but are intentionally excluded from the workbook analysis calculations.

## Workbook Coverage

The supplied 2026-2027 workbook normalizes these sources:

| Source | Normalized records | Supported analytics |
| --- | ---: | --- |
| Brick sales data | 211 sales | Invoiced sales, monthly trend, product and customer totals |
| Monthly factory expenses | 248 expenses | Recorded expenses by month and category |
| Raw material purchase data | 67 purchases | Purchase value, driver batta, material mix, pending markers |
| Labour payments | 27 payments | Payment obligation, stated pending amount, work breakdown |
| Production data | 200 daily records | Produced units, production days, no-production days and reasons |
| Customer/vendor sheets | Reference rows | Exact-name identity support and source traceability |

The complete workbook produces 936 source rows: 494 imported cleanly, 306 retained with
review flags, and 136 skipped as headings, totals, blanks or non-transaction reference rows.

## Implemented Visual Analytics

The Admin Portal uses the existing SS Bricks design system and renders these workbook-backed
views without reading the XLSX at runtime:

- **Overview:** invoiced sales, recorded outflows, sales-to-outflow coverage, production
  output, no-production rows, review rows, deterministic attention items, a monthly
  sales-versus-outflows line/point chart, outflow donut chart, product revenue bars, top
  customers, and source coverage.
- **Sales:** invoiced sales, average invoice value, sale count, unique customer count,
  monthly column chart, product revenue donut, recorded price summary, customer bars, and the
  searchable/editable sales log.
- **Finance:** recorded outflows, factory expenses, material purchases, labour obligations,
  driver batta, explicitly pending purchase value, monthly line/point chart, outflow donut,
  expense/material/vendor bars, purchase-status summary, and receipt/expense/purchase logs.
- **Operations:** production output, production entries, distinct dated production days,
  average output per entry, no-production and Sunday rows, monthly output line/point chart,
  product bars, monthly activity columns, reason summary, and production log.
- **Labour:** payment obligations, stated pending amount, record count, average payment,
  monthly line/point chart, payment-method donut, work-description bars, and labour log.
- **Insights:** deterministic workbook findings, reconciliation context, and a reference
  coverage matrix that explains every unavailable reference metric.

The Overview attention list ranks decision-oriented signals before import-quality notices.
Each row includes a severity, responsible department, factual finding, and calculation
context. Current rules cover sales versus recorded outflows, month-over-month invoiced-sales
movement, purchases explicitly marked pending, no-production frequency and recorded reasons,
and product revenue concentration. Reconciliation and review notices remain available lower
in the complete Insights list.

Horizontal bars, columns, donut charts, and line charts with visible data points are rendered
with local HTML/CSS/SVG only; no external chart service or client-side workbook dependency is
introduced.

## Reconciliation

Analytics uses normalized transaction lines and exposes source variances instead of hiding
them:

- Sales line items: INR 2,301,275, matching the workbook total.
- Factory expenses: INR 1,914,986 normalized versus INR 1,919,306 in workbook totals, a
  variance of INR -4,320.
- Production: 120,591 normalized units versus 117,821 in workbook monthly totals, a variance
  of +2,770 units.
- Raw-material purchases: INR 1,114,060 plus INR 8,600 driver batta. Workbook summary rows do
  not apply one consistent treatment to driver batta, so the two values remain separate.

## Metric Rules

- Historical invoiced sales are the sum of active normalized sale line items.
- Recorded outflows are factory expenses + material purchases + driver batta + labour payment
  obligations. This is not profit, cash flow, or cost of goods sold.
- Production units include only rows classified as `PRODUCTION`; Sundays and explicit
  no-production rows are reported separately. Production entries and distinct dated
  production days are reported as separate metrics.
- Sales-to-outflow coverage compares workbook invoiced sales with recorded outflows. It is
  explicitly not net profit, gross margin, cash flow, or break-even.
- Average recorded product price is calculated only from sale rows with an explicit unit-price
  value. No target price or price-realisation percentage is inferred.
- Workbook receipt cells are preserved for review but excluded from official collections and
  receivable calculations because their meaning is inconsistent.
- Updates require a correction reason. Deletes are implemented as audited void/archive
  operations; records are not physically removed.

## Intentionally Unavailable

The current data cannot truthfully calculate the following reference metrics:

- **Marketing funnel, enquiries, conversion, cost per lead, and marketing spend:** no enquiry,
  campaign, lead-source, quotation-stage, site-visit, or marketing-spend fields exist in the
  workbook.
- **Cash/bank balance, net profit, COGS, gross margin, and break-even:** the workbook is not a
  complete accrual ledger and has no cash balances, inventory valuation, or expense-to-product
  cost mapping.
- **Receivables, ageing, and credit-sales percentage:** historical receipt and outstanding
  cells mix combined payments and cumulative balances that cannot be allocated reliably to
  individual invoices.
- **Capacity utilization, wastage, downtime, power per 1,000 units, and stock:** installed
  capacity, rejects, machine hours, meter readings, and inventory balances are absent.
- **Headcount, attendance, attrition, targets, and worker performance:** there is no employee
  roster, attendance register, join/exit dates, target table, or named worker output.

The portal labels these as unavailable and does not infer them from unrelated fields.

## Import Workflow

1. Open Admin Portal -> Analytics.
2. Select **Import Business XLSX**.
3. Choose the workbook and run **Preview**.
4. Review counts, warning samples and reconciliation differences.
5. Commit the import once the preview is acceptable.
6. Use each log's **Add** action for new manual entries, or edit/void existing rows with an
   audit reason. Use the source selector to view all, workbook-only, or manual-only rows.

Before production deployment, apply the Prisma migration to the same PostgreSQL database used
by Vercel:

```cmd
set "DATABASE_URL=postgresql://...production-neon-url..."
npm.cmd run prisma:deploy
```

Do not use a local or different Neon connection string for this deployment step.
