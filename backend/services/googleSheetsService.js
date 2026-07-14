const crypto = require('crypto');
const env = require('../config/env');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const headerAliases = {
  enquiryNumber: ['enquiry id', 'enquiry number', 'quote id', 'lead id'],
  submittedDate: ['submitted date', 'date'],
  submittedTime: ['submitted time', 'time'],
  customerName: ['customer name', 'name'],
  phone: ['mobile number', 'phone number', 'phone', 'mobile'],
  location: ['location', 'address'],
  product: ['product', 'interested product'],
  quantity: ['quantity', 'qty'],
  deliveryDate: ['required delivery date', 'requested delivery date', 'delivery date'],
  message: ['message', 'notes', 'remarks'],
  status: ['status'],
  source: ['source', 'lead source'],
  pdfGenerated: ['pdf generated', 'pdf'],
  emailSent: ['email sent', 'email'],
  whatsappSent: ['whatsapp sent', 'whatsapp'],
  assignedTo: ['assigned to', 'owner'],
  createdBy: ['created by'],
};

const defaultHeaders = [
  'Enquiry ID',
  'Submitted Date',
  'Submitted Time',
  'Customer Name',
  'Mobile Number',
  'Location',
  'Product',
  'Quantity',
  'Required Delivery Date',
  'Message',
  'Status',
  'Source',
  'PDF Generated',
  'Email Sent',
  'WhatsApp Sent',
  'Assigned To',
  'Created By',
];

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function display(value) {
  return value === null || value === undefined ? '' : String(value);
}

function displayDate(value) {
  return value ? DATE_FORMAT.format(new Date(value)) : '';
}

function quoteValues(data, pipeline = {}) {
  return {
    enquiryNumber: data.quote.enquiryNumber,
    submittedDate: DATE_FORMAT.format(new Date(data.quote.createdAt)),
    submittedTime: TIME_FORMAT.format(new Date(data.quote.createdAt)),
    customerName: data.customer.name,
    phone: data.customer.phone,
    location: data.customer.location,
    product: data.quote.product,
    quantity: data.quote.quantity,
    deliveryDate: displayDate(data.quote.deliveryDate),
    message: data.quote.message,
    status: data.quote.status,
    source: data.quote.source || 'WEBSITE',
    pdfGenerated: pipeline.pdfGenerated ? 'Yes' : 'No',
    emailSent: pipeline.emailSent ? 'Yes' : 'No',
    whatsappSent: pipeline.whatsappSent ? 'Yes' : 'No',
    assignedTo: data.quote.assignedTo || '',
    createdBy: 'Website',
  };
}

function fieldForHeader(header) {
  const normalized = normalizeHeader(header);
  return Object.entries(headerAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] || null;
}

function validateConfig(config) {
  const errors = [];
  if (!config.enabled) errors.push('Google Sheets integration is disabled.');
  if (!config.spreadsheetId) errors.push('GOOGLE_SHEET_ID is not configured.');
  if (!config.clientEmail) errors.push('GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured.');
  if (!config.privateKey) errors.push('GOOGLE_PRIVATE_KEY is not configured.');
  return {
    valid: errors.length === 0,
    errors,
  };
}

class GoogleSheetsService {
  constructor({ config = env.googleSheets, fetchImpl = globalThis.fetch } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.accessToken = null;
    this.expiresAt = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.expiresAt - 60000) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(JSON.stringify({
      iss: this.config.clientEmail,
      scope: GOOGLE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }));
    const unsigned = `${header}.${claim}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), this.config.privateKey);
    const assertion = `${unsigned}.${base64Url(signature)}`;

    const response = await this.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error_description || result.error || 'Could not authenticate Google Sheets.');
    }

    this.accessToken = result.access_token;
    this.expiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
    return this.accessToken;
  }

  async request(path, options = {}) {
    const token = await this.getAccessToken();
    const response = await this.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || 'Google Sheets request failed.');
    }
    return result;
  }

  async getHeaders() {
    const range = encodeURIComponent(`${this.config.sheetName}!1:1`);
    const result = await this.request(`/values/${range}`);
    return result.values?.[0] || [];
  }

  async ensureHeaders() {
    const headers = await this.getHeaders();
    if (headers.length) return headers;

    const range = encodeURIComponent(`${this.config.sheetName}!A1`);
    await this.request(`/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        values: [defaultHeaders],
      }),
    });
    return defaultHeaders;
  }

  async appendQuote(data, pipeline = {}) {
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.code = 'GOOGLE_SHEETS_CONFIG_INVALID';
      throw error;
    }

    const headers = await this.ensureHeaders();
    const values = quoteValues(data, pipeline);
    const row = headers.map((header) => {
      const field = fieldForHeader(header);
      return field ? display(values[field]) : '';
    });

    const range = encodeURIComponent(`${this.config.sheetName}!A:Z`);
    await this.request(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({
        values: [row],
      }),
    });

    return {
      status: 'SUCCESS',
      row,
    };
  }
}

module.exports = {
  GoogleSheetsService,
  __private: {
    defaultHeaders,
    fieldForHeader,
    normalizeHeader,
    quoteValues,
    validateConfig,
  },
};
