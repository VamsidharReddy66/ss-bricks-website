# SS Bricks Business Management System

Phase 1.4 provides a Node.js, Express, Prisma, and PostgreSQL backed lead management system, asynchronous admin email notifications, live product pricing APIs, and an SS Bricks branded admin portal.

The approved public HTML/CSS layout is preserved. Product prices and product dropdowns are hydrated from PostgreSQL through `/api/products`, so price changes do not require website code changes. The quotation forms validate input, save enquiries through `/api/quotes`, create website-sourced leads, and open WhatsApp only after the database write succeeds. Email notification runs in the background after the response and never controls whether a quote is accepted.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start PostgreSQL with Docker:

   ```bash
   docker compose up -d postgres
   ```

3. Generate Prisma client and apply migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. Start the website and API:

   ```bash
   npm run start
   ```

5. Open the site:

   ```text
   http://localhost:3000
   ```

## Environment

Copy `.env.example` to `.env` and update values for each environment.

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://ssb_user:ssb_password@localhost:5432/ssb_business?schema=public"
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=change-this-before-production
ADMIN_EMAIL=admin@ssbricks.local
ADMIN_PASSWORD=change-this-admin-password
ADMIN_NAME=SS Bricks Admin
WHATSAPP_PHONE=919876543210
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@example.com
SMTP_PASSWORD=provider-app-password
SS_BRICKS_EMAIL=sales@ssbricks.com
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=15000
RAZORPAY_KEY_ID=
RAZORPAY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

## SMTP Setup

`SMTP_USER` is the authenticated sender account. `SS_BRICKS_EMAIL` is the only notification recipient. The quotation form can collect an optional customer email for Razorpay Checkout prefill, but no customer email is sent automatically.

## Razorpay Test Mode

The admin confirms a final quotation amount in the lead details and shares the generated
customer payment link. The backend creates the Razorpay order from that stored amount,
verifies the returned signature, confirms the payment status with Razorpay, and stores a PDF
receipt in PostgreSQL. Live key IDs are rejected by this test-only build.

```env
RAZORPAY_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_separate_test_webhook_secret
```

For webhook testing, configure `https://your-domain/api/payment/webhook` in Razorpay Dashboard
Test Mode. The webhook secret is separate from the API key secret.

### Gmail

1. Enable two-step verification on the sender Google account.
2. Create a Google app password.
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`.
4. Set `SMTP_USER` to the complete Gmail address and `SMTP_PASSWORD` to the 16-character app password.

Google account passwords should not be used as SMTP passwords.

### Outlook / Microsoft 365

Set `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`. Set `SMTP_USER` and `SMTP_PASSWORD` to credentials permitted to use authenticated SMTP. Some Microsoft 365 tenants require an administrator to enable SMTP AUTH for the mailbox.

### Notification Behavior

- The quote and customer are committed before notification begins.
- The API returns immediately and WhatsApp opens without waiting for SMTP.
- Each attempt creates a `NotificationLog` with `SUCCESS` or `FAILED`.
- SMTP errors are logged and never roll back or delete a quote.
- Missing SMTP settings produce a startup warning and a failed notification log rather than stopping quote capture.

## Project Structure

```text
backend/
  config/
  controllers/
  middleware/
  prisma/
  routes/
  services/
  tests/
  uploads/
  utils/
  validators/
  app.js
  server.js
css/
images/
js/
docs/
```

## Admin Portal

Local URL:

```text
http://localhost:3000/admin.html
```

If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the server creates or updates that admin account at startup using bcrypt. Replace the local password before production.

Admin APIs:

```text
POST /api/admin/login
GET /api/admin/dashboard
GET /api/admin/leads
POST /api/admin/leads
GET /api/admin/leads/:id
PUT /api/admin/leads/:id
POST /api/admin/leads/:id/activities
PUT /api/admin/leads/:id/status
POST /api/admin/leads/import/preview
POST /api/admin/leads/import/commit
GET /api/admin/products
PUT /api/admin/products/:id
GET /api/admin/price-history
GET /api/admin/quotes  (backward-compatible alias for leads)
```

Lead import supports CSV and Excel `.xlsx` files. Preview detects common column names such as `Mobile`, `Phone Number`, `Customer Name`, `First Name`, `Last Name`, `Lead Stage`, and `Organization`, then reports valid rows and duplicates before commit. Admins can adjust column mapping, choose duplicate handling per duplicate row, and review the final created/updated/skipped summary inside the import modal.

Public product APIs:

```text
GET /api/products
GET /api/products/:slug
```

## Useful Commands

```bash
npm run test
npm run prisma:studio
npm run prisma:deploy
```

The automated suite covers successful email delivery, authentication failure, invalid credentials, unavailable SMTP, timeout, missing configuration, notification logging, and quote preservation.

## Production Notes

- For Vercel deployment, follow `docs/VERCEL_DEPLOYMENT.md`.
- Use a managed PostgreSQL database and set `DATABASE_URL`.
- Store SMTP credentials in the deployment platform's encrypted secret store.
- Use a dedicated sender mailbox and provider-issued app password.
- Confirm outbound SMTP access from the hosting provider before launch.
- Monitor failed `NotificationLog` records and application error logs.
- Replace `JWT_SECRET` with a strong secret before adding admin authentication flows.
- Keep `CORS_ORIGIN` restricted to the deployed frontend domain.
- Run `npm run prisma:deploy` during deployment.
- Store uploads outside the application filesystem or move to Cloudinary in later phases.
