const xlsx = require('xlsx');
const { prisma } = require('../config/database');
const { leadCreateSchema } = require('../validators/leadValidator');

const columnAliases = {
  name: ['customer name', 'name', 'full name', 'client name'],
  firstName: ['first name', 'firstname', 'first'],
  lastName: ['last name', 'lastname', 'surname', 'last'],
  phone: ['phone number', 'mobile', 'mobile number', 'contact', 'phone', 'contact number'],
  company: ['company', 'company name', 'organization', 'organisation', 'business'],
  location: ['location', 'city', 'address', 'address name', 'site location'],
  product: ['interested product', 'product', 'material', 'item'],
  quantity: ['quantity', 'qty', 'required quantity'],
  source: ['lead source', 'source', 'origin'],
  status: ['lead stage', 'stage', 'status'],
  priority: ['priority'],
  notes: ['notes', 'note', 'crm notes', 'remarks', 'message'],
  assignedTo: ['assign to', 'assigned to', 'owner'],
};

const sourceMap = {
  website: 'WEBSITE',
  phone: 'PHONE',
  'walk in': 'WALK_IN',
  'walk-in': 'WALK_IN',
  whatsapp: 'WHATSAPP',
  indiamart: 'INDIAMART',
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
  reference: 'REFERENCE',
  manual: 'MANUAL',
  csv: 'CSV_IMPORT',
  'csv import': 'CSV_IMPORT',
};

const statusMap = {
  new: 'NEW',
  contacted: 'CONTACTED',
  'follow up': 'FOLLOW_UP',
  followup: 'FOLLOW_UP',
  'quotation sent': 'QUOTATION_SENT',
  negotiation: 'NEGOTIATION',
  won: 'WON',
  lost: 'LOST',
  closed: 'CLOSED',
};

const priorityMap = {
  low: 'LOW',
  medium: 'MEDIUM',
  normal: 'MEDIUM',
  high: 'HIGH',
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function detectMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapping = {};
  const confidence = {};

  for (const [field, aliases] of Object.entries(columnAliases)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      mapping[field] = headers[index];
      confidence[field] = 1;
    }
  }

  if (!mapping.name && mapping.firstName && mapping.lastName) {
    mapping.name = `${mapping.firstName}+${mapping.lastName}`;
    confidence.name = 0.85;
  }

  return {
    mapping,
    confidence,
  };
}

function sanitizeMapping(mapping, headers) {
  if (!mapping || typeof mapping !== 'object') return null;

  const allowedHeaders = new Set(headers);
  const clean = {};
  for (const [field, header] of Object.entries(mapping)) {
    if (typeof header !== 'string' || !header) continue;
    if (header.includes('+')) {
      const parts = header.split('+');
      if (parts.length === 2 && parts.every((part) => allowedHeaders.has(part))) {
        clean[field] = header;
      }
      continue;
    }
    if (allowedHeaders.has(header)) {
      clean[field] = header;
    }
  }

  return clean;
}

function parseCsv(content) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      current.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      current.push(cell);
      if (current.some((value) => String(value).trim())) rows.push(current);
      current = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  current.push(cell);
  if (current.some((value) => String(value).trim())) rows.push(current);
  return rows;
}

function rowsFromCsv(buffer) {
  const parsed = parseCsv(buffer.toString('utf8'));
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((header) => String(header || '').trim());
  return parsed.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function rowsFromXlsx(buffer) {
  const workbook = xlsx.read(buffer, {
    type: 'buffer',
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
  });
}

function value(row, header) {
  if (!header) return '';
  const cell = String(row[header] || '').trim();
  return cell === '-' ? '' : cell;
}

function normalizeEnum(input, map, fallback) {
  return map[normalizeHeader(input)] || fallback;
}

function normalizeRow(row, mapping) {
  const [firstNameHeader, lastNameHeader] = String(mapping.name || '').split('+');
  const name = mapping.name?.includes('+')
    ? `${value(row, firstNameHeader)} ${value(row, lastNameHeader)}`.trim()
    : value(row, mapping.name);
  const product = value(row, mapping.product) || 'Not specified';
  const quantity = value(row, mapping.quantity) || '0';
  const location = value(row, mapping.location) || 'Not provided';

  return {
    name,
    phone: value(row, mapping.phone),
    company: value(row, mapping.company),
    location,
    product,
    quantity,
    source: normalizeEnum(value(row, mapping.source), sourceMap, 'CSV_IMPORT'),
    status: normalizeEnum(value(row, mapping.status), statusMap, 'NEW'),
    priority: normalizeEnum(value(row, mapping.priority), priorityMap, 'MEDIUM'),
    notes: value(row, mapping.notes),
    assignedTo: value(row, mapping.assignedTo),
  };
}

async function duplicateSummary(rows) {
  const phones = [...new Set(rows.map((row) => row.phone).filter(Boolean))];
  const customers = await prisma.customer.findMany({
    where: {
      phone: {
        in: phones,
      },
    },
    select: {
      phone: true,
    },
  });
  const existingPhones = new Set(customers.map((customer) => customer.phone));
  const seenPhones = new Set();

  return rows.map((row) => {
    const duplicateInFile = seenPhones.has(row.phone);
    if (row.phone) seenPhones.add(row.phone);
    return {
      ...row,
      duplicate: existingPhones.has(row.phone) || duplicateInFile,
      duplicateReason: existingPhones.has(row.phone)
        ? 'Phone already exists'
        : duplicateInFile
          ? 'Duplicate phone in file'
          : null,
    };
  });
}

async function previewImport(file, overrideMapping = null) {
  const lowerName = file.originalname.toLowerCase();
  const rawRows = lowerName.endsWith('.xlsx') ? rowsFromXlsx(file.buffer) : rowsFromCsv(file.buffer);
  const rows = rawRows.slice(0, 500);
  if (!rows.length) {
    const error = new Error('No importable lead rows were found in this file.');
    error.statusCode = 400;
    error.field = 'file';
    throw error;
  }

  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const detected = detectMapping(headers);
  const mapping = sanitizeMapping(overrideMapping, headers) || detected.mapping;
  const confidence = overrideMapping ? Object.fromEntries(Object.keys(mapping).map((field) => [field, 1])) : detected.confidence;
  const normalizedRows = rows.map((row) => normalizeRow(row, mapping));
  const parsedRows = normalizedRows.map((row, index) => {
    const parsed = leadCreateSchema.safeParse(row);
    return {
      rowNumber: index + 2,
      valid: parsed.success,
      data: parsed.success ? parsed.data : row,
      errors: parsed.success ? [] : parsed.error.errors.map((error) => error.message),
    };
  });
  const duplicates = await duplicateSummary(parsedRows.filter((row) => row.valid).map((row) => row.data));
  const duplicateByPhone = new Map(duplicates.map((row) => [row.phone, row]));

  return {
    headers,
    mapping,
    confidence,
    totalRows: rows.length,
    validRows: parsedRows.filter((row) => row.valid).length,
    invalidRows: parsedRows.filter((row) => !row.valid).length,
    previewRows: parsedRows.slice(0, 20).map((row) => ({
      ...row,
      duplicate: row.valid ? Boolean(duplicateByPhone.get(row.data.phone)?.duplicate) : false,
      duplicateReason: row.valid ? duplicateByPhone.get(row.data.phone)?.duplicateReason || null : null,
    })),
    rows: parsedRows.filter((row) => row.valid).map((row) => ({
      ...row.data,
      duplicate: Boolean(duplicateByPhone.get(row.data.phone)?.duplicate),
      duplicateReason: duplicateByPhone.get(row.data.phone)?.duplicateReason || null,
    })),
  };
}

module.exports = {
  __private: {
    detectMapping,
    normalizeRow,
    rowsFromCsv,
  },
  previewImport,
};
