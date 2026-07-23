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
  "productId": 1,
  "quantity": 10000
}
```

Response data includes wall area in square feet, wall volume in cubic feet, selected product
details, entered quantity, current unit price, and estimated cost for that quantity. The
dimension-based unit estimate is `null` when verified product dimensions are not configured.

Calculator validation rejects non-positive wall dimensions, unsupported wall units, inactive
or incomplete configuration records, missing prices, and quantities that are not positive
whole numbers.

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
