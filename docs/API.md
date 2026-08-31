# API Documentation

## Health Check

```http
GET /health
```

Response:

```json
{
  "success": true,
  "message": "SS Bricks API is healthy.",
  "data": {
    "uptime": 12.34
  }
}
```

## Create Quote Request

```http
POST /api/quotes
Content-Type: application/json
```

Request:

```json
{
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "location": "Tirupati",
  "product": "Fly Ash Bricks",
  "quantity": 10000,
  "deliveryDate": "2026-07-10",
  "message": "Need delivery in the morning."
}
```

Success response:

```json
{
  "success": true,
  "message": "Quotation submitted successfully.",
  "data": {
    "enquiryNumber": "SSB-20260702-0001",
    "quoteId": 1,
    "status": "NEW",
    "createdAt": "2026-07-02T16:45:00.000Z"
  }
}
```

Validation error response:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "phone",
      "message": "Phone number must be a valid 10 digit Indian mobile number."
    }
  ]
}
```

## Validation Rules

- `name`: required, 2-100 characters, alphabets and spaces only, no consecutive spaces.
- `phone`: required, Indian mobile number, exactly 10 digits, starts with 6, 7, 8, or 9.
- `location`: required, 2-100 characters.
- `product`: required; one of Fly Ash Bricks, Solid Cement Blocks, Paver Blocks, Mud Bricks.
- `quantity`: required, whole positive number, maximum 100000.
- `deliveryDate`: required, `YYYY-MM-DD`, cannot be in the past.
- `message`: optional, maximum 500 characters.

## Material Calculator Configuration

```http
GET /api/calculator/config
```

Returns all four database-managed products, their current standard prices, units and
availability, plus wall-thickness options. Product prices and thickness values are not
hardcoded in the browser. Physical dimensions are included in calculations only when a
verified matching calculator configuration exists.

## Calculate Material Estimate

```http
POST /api/calculator/calculate
Content-Type: application/json
```

Request:

```json
{
  "height": 10,
  "heightUnit": "ft",
  "width": 12,
  "widthUnit": "ft",
  "thicknessId": 2,
  "productId": 1
}
```

Response data includes wall area in square feet, wall volume in cubic feet, selected product
details, catalogue-based physical-unit estimate, server-derived billable quantity, current
unit price, and estimated cost. Brick and block products are billed by the calculated whole
piece count. Paver Blocks are billed by the calculated square-foot area while also returning
their approximate physical piece count.

Calculator validation rejects non-positive wall dimensions, unsupported wall units, inactive
or incomplete catalogue configuration records, and missing prices. Client-supplied quantity
is rejected because quantity and cost are calculated by the server.

## Razorpay Test Payments

Payments use an admin-confirmed quotation amount. The browser never submits or overrides the
amount used to create a Razorpay order. Only `rzp_test_` API keys are accepted.

```http
PUT /api/admin/leads/:id/payment
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "finalAmount": 12500.50 }
```

Returns a random customer payment URL. Share that URL only with the relevant customer.

```http
GET /api/payment/quote/:paymentToken
POST /api/payment/create-order
POST /api/payment/verify
GET /api/payment/quote/:paymentToken/receipt
```

Order creation uses the amount stored on the quotation. Verification checks the HMAC
signature, fetches the payment from Razorpay, validates order, amount and currency, and marks
the payment successful only when Razorpay reports it as captured. The receipt endpoint returns
the database-backed PDF for the successful test payment.

```http
POST /api/payment/webhook
X-Razorpay-Signature: <signature>
```

This endpoint validates the signature against the raw request body. Event reconciliation is
intentionally left as future work and is not executed by this verification-only endpoint.

## Admin Analytics

All analytics endpoints require an admin bearer token. Supported periods are
`LAST_30_DAYS`, `LAST_90_DAYS`, `LAST_6_MONTHS`, `THIS_YEAR`, and `ALL`.

```http
GET /api/admin/analytics?range=LAST_6_MONTHS
Authorization: Bearer <admin-token>
```

The response is deliberately scoped to active normalized business records whose origin is
`XLSX_IMPORT`. Its top-level `scope` is `XLSX_IMPORT_ONLY`, and the `business` object contains
workbook sales, expenses, material purchases, production, labour, import reconciliation,
data-quality warnings, workbook-backed insights, and a `referenceCoverage` matrix.

The `business` response includes:

- `overview.monthlyPerformance` and `overview.outflowComposition`
- sales totals, average invoice value, unique customers, monthly series, product price/revenue
  summaries, and customer ranking
- finance totals, monthly recorded outflows, outflow composition, expense/material/vendor
  breakdowns, and purchase-status markers
- production output, distinct dated days, entry counts, monthly output/activity, product mix,
  and no-production reasons
- labour obligations, average/stated pending values, monthly trend, payment methods, and work
  breakdowns

All monetary comparisons retain their source meaning. In particular, recorded outflows are
not returned as profit, COGS, cash flow, or break-even, and unallocated workbook receipts are
not returned as official collections or receivables.

Website leads, Leads CSV imports, manually created CRM leads, application payments,
deliveries, offline sales, manually created business-ledger records, assignments, follow-ups,
and administrator activity are not queried by this endpoint. Those workflows remain stored
and available outside Analytics.

## Admin Sales Log

```http
GET /api/admin/sales?range=LAST_6_MONTHS&type=ALL&status=ALL&page=1&limit=20
Authorization: Bearer <admin-token>
```

The sales log merges quote-backed records with editable offline sales. Quote-backed records
remain linked to their existing lead and payment data and are not duplicated.

```http
PUT /api/admin/sales/grid
Authorization: Bearer <admin-token>
Content-Type: application/json
```

The grid endpoint atomically saves up to 100 changed quote or offline rows. Each update must
include the record's `expectedUpdatedAt` value; stale edits receive HTTP `409` instead of
overwriting a newer change. Quote customer, product, quantity, and invoiced amount fields can
be edited. Verified quote payment receipts, enquiry numbers, and quote dates remain protected.
Offline rows support the complete editable sale payload.

```http
POST /api/admin/sales
PUT /api/admin/sales/:id
DELETE /api/admin/sales/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

Offline sale request:

```json
{
  "customerName": "Ravi Kumar",
  "customerPhone": "9876543210",
  "location": "Tirupati",
  "product": "Fly Ash Bricks",
  "quantity": 1000,
  "unitPrice": 10,
  "invoicedAmount": 10000,
  "receivedAmount": 4000,
  "saleDate": "2026-07-20",
  "receivedDate": "2026-07-20",
  "paymentMethod": "UPI",
  "notes": "Partial payment received."
}
```

The product must already exist in the SS Bricks product catalogue. Received amount cannot
exceed the invoice amount, and a received date is required when money has been collected.

## Business Workbook Import

All endpoints require an admin bearer token. The uploaded workbook is used only as an import
source. Analytics reads normalized PostgreSQL records after the import completes.

```http
POST /api/admin/business-import/preview
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

file=<xlsx-workbook>
```

Preview parses semantic headers, excludes totals and blank rows, and returns record counts,
review flags, duplicate-file status, and reconciliation results without writing to the
database.

```http
POST /api/admin/business-import/commit
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

file=<same-xlsx-workbook>
```

Commit re-parses the workbook and stores the import batch, every traceable source row, and
normalized sales, receipt-reference, expense, material-purchase, production, and labour
records in one database transaction. Importing the same file hash again is rejected.

```http
GET /api/admin/business-imports
Authorization: Bearer <admin-token>
```

## Business Logs

Supported record types are `sales`, `receipts`, `expenses`, `purchases`, `production`,
`labour`, and `events`.

```http
GET /api/admin/business-records/:type?page=1&limit=25&search=&state=ACTIVE&origin=XLSX_IMPORT&range=ALL
POST /api/admin/business-records/:type
PUT /api/admin/business-records/:type/:id
DELETE /api/admin/business-records/:type/:id
Authorization: Bearer <admin-token>
```

Create requests use the record payload directly. Updates use
`{ "data": { ...recordFields }, "reason": "Correction reason" }`. Delete requests use
`{ "reason": "Void reason" }` and perform a reversible audit-preserving void/archive rather
than a hard delete. Every create, update, and void operation writes an audit entry with the
administrator and before/after values.

The Analytics UI exposes a source selector for these logs and sends `origin=ALL`,
`origin=XLSX_IMPORT`, or `origin=MANUAL`. New records created through the log forms are stored
as `MANUAL`, displayed with a separate source label, and excluded from workbook-only KPI,
chart, and insight calculations. Historical XLSX receipt fields remain review-only because
the workbook mixes individual receipts, combined payments, text statuses, and cumulative
balances; collections and receivables are therefore not calculated from them.
