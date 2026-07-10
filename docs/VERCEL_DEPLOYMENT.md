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
```

Do not use the local `.env` file or a personal password in Vercel. Use the provider-issued app password for SMTP.

## Database

Use a managed PostgreSQL database. Before the first production launch, run:

```bash
npm run prisma:deploy
```

The Vercel build only generates the Prisma client. It does not run migrations automatically.

## Deployment Validation

After deployment:

1. Open `/health` and confirm it returns `success: true`.
2. Open `/admin.html` and log in with the production admin credentials.
3. Submit one quote from the public website.
4. Confirm the lead appears in Admin > Leads.
5. Confirm the notification email is received.
6. Import a small CSV and confirm preview, duplicate review, and import summary.
7. Confirm Dashboard Total Leads equals all stored leads.

## Production Guards

The server refuses to start with `NODE_ENV=production` when:

- `JWT_SECRET` is missing, still set to the placeholder, or shorter than 32 characters.
- `ADMIN_EMAIL` is missing.
- `ADMIN_PASSWORD` is missing, still set to the placeholder, or shorter than 12 characters.
- `CORS_ORIGIN` is missing or still points to `localhost`.
