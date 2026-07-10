function sanitizeString(value) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

function sanitizeValue(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [key, sanitizeValue(childValue)])
    );
  }

  return value;
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  next();
}

module.exports = sanitizeRequest;
