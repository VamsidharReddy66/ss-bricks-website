# Postman Testing Examples

Create a Postman environment variable:

```text
baseUrl = http://localhost:3000
```

## 1. Health Check

Method: `GET`

URL:

```text
{{baseUrl}}/health
```

Expected status: `200 OK`

## 2. Create Valid Quote

Method: `POST`

URL:

```text
{{baseUrl}}/api/quotes
```

Headers:

```text
Content-Type: application/json
```

Body:

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

Expected status: `201 Created`

## 3. Invalid Phone Test

Body:

```json
{
  "name": "Ravi Kumar",
  "phone": "12345",
  "location": "Tirupati",
  "product": "Fly Ash Bricks",
  "quantity": 10000,
  "deliveryDate": "2026-07-10",
  "message": ""
}
```

Expected status: `400 Bad Request`

## 4. Empty Request Test

Body:

```json
{}
```

Expected status: `400 Bad Request`
