# SS Bricks Vercel Deployment Checklist

This project can run on Vercel with static HTML/CSS/JS at the root and the existing Express API through `api/index.js`.

## Required Vercel Environment Variables

Set these in Vercel Project Settings before production deployment:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=use-a-strong-secret-with-at-least-32-characters
CORS_ORIGIN=https://your-vercel-domain.vercel.app
ADMIN_EMAIL=client-admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=SS Bricks Admin
WHATSAPP_PHONE=91XXXXXXXXXX
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@example.com
SMTP_PASSWORD=provider-app-password
SS_BRICKS_EMAIL=recipient@example.com
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=15000
GOOGLE_SHEETS_ENABLED=false
GOOGLE_SHEET_ID=
GOOGLE_SHEET_NAME=Quotes
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
WHATSAPP_PROVIDER_URL=
WHATSAPP_ACCESS_TOKEN=
RAZORPAY_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_separate_test_webhook_secret
```

Do not use the local `.env` file or a personal password in Vercel. Use the provider-issued app password for SMTP.
Razorpay keys must come from Dashboard Test Mode. This build rejects key IDs that do not start with `rzp_test_`.
The webhook secret is configured separately in Razorpay Test Mode webhook settings; it is not the API key secret.

## Database

Use a managed PostgreSQL database. Before the first production launch, run:

```bash
npm run prisma:deploy
```

The Vercel build only generates the Prisma client. It does not run migrations automatically.
The payment migration adds confirmed quotation amounts, customer email, secure payment tokens,
payment records, and database-backed receipt storage.

## Deployment Validation

After deployment:

1. Open `/health` and confirm it returns `success: true`.
2. Open `/admin.html` and log in with the production admin credentials.
3. Submit one quote from the public website.
4. Confirm the lead appears in Admin > Leads.
5. Confirm the notification email is received.
6. Open the generated PDF URL from the quote record if needed.
7. Import a small CSV and confirm preview, duplicate review, and import summary.
8. Confirm Dashboard Total Leads equals all stored leads.
9. Set a final payment amount on a test lead and open the generated payment link.
10. Complete a Razorpay Test Mode payment and download its receipt.

## Google Sheets

Google Sheets is optional and is not the database. PostgreSQL remains authoritative.

To enable Sheet append:

1. Create a Google Cloud service account.
2. Enable the Google Sheets API.
3. Share the target spreadsheet with the service account email.
4. Set `GOOGLE_SHEETS_ENABLED=true`.
5. Set `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_NAME`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY`.

The pipeline maps columns by header name and appends rows only. Unsupported columns are left blank.

## WhatsApp PDF

The existing website WhatsApp text fallback remains active. To send PDF documents from the backend, configure a provider endpoint with:

- `WHATSAPP_PROVIDER_URL`
- `WHATSAPP_ACCESS_TOKEN`

If no provider is configured, the pipeline logs a fallback event and quote submission still succeeds.

## Production Guards

The server refuses to start with `NODE_ENV=production` when:

- `JWT_SECRET` is missing, still set to the placeholder, or shorter than 32 characters.
- `ADMIN_EMAIL` is missing.
- `ADMIN_PASSWORD` is missing, still set to the placeholder, or shorter than 12 characters.
- `CORS_ORIGIN` is missing or still points to `localhost`.
