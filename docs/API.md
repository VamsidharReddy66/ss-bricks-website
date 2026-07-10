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
