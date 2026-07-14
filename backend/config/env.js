const dotenv = require('dotenv');

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 3000);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const jwtSecret = process.env.JWT_SECRET;

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (nodeEnv === 'production') {
  const productionErrors = [];

  if (!jwtSecret || jwtSecret === 'change-this-before-production' || jwtSecret.length < 32) {
    productionErrors.push('JWT_SECRET must be a strong production secret with at least 32 characters.');
  }

  if (!process.env.ADMIN_EMAIL) {
    productionErrors.push('ADMIN_EMAIL is required in production.');
  }

  if (
    !process.env.ADMIN_PASSWORD
    || process.env.ADMIN_PASSWORD === 'change-this-admin-password'
    || process.env.ADMIN_PASSWORD.length < 12
  ) {
    productionErrors.push('ADMIN_PASSWORD must be changed before production and contain at least 12 characters.');
  }

  if (!process.env.CORS_ORIGIN || corsOrigin.includes('localhost')) {
    productionErrors.push('CORS_ORIGIN must be set to the deployed website URL in production.');
  }

  if (productionErrors.length) {
    throw new Error(`Production environment is not ready: ${productionErrors.join(' ')}`);
  }
}

module.exports = {
  nodeEnv,
  port,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin,
  jwtSecret,
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'SS Bricks Admin',
  },
  whatsappPhone: process.env.WHATSAPP_PHONE || '919876543210',
  whatsapp: {
    providerUrl: process.env.WHATSAPP_PROVIDER_URL || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  },
  googleSheets: {
    enabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
    spreadsheetId: process.env.GOOGLE_SHEET_ID || '',
    sheetName: process.env.GOOGLE_SHEET_NAME || 'Quotes',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    recipient: process.env.SS_BRICKS_EMAIL || '',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
  },
};
