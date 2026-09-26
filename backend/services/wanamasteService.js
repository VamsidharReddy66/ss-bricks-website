const net = require('net');
const env = require('../config/env');

const DOCUMENTATION_PATHS = Object.freeze([
  '',
  'openapi.json',
  'swagger.json',
  'api-docs',
  'api-docs.json',
  'docs',
  'swagger',
  'swagger-ui',
  'swagger-ui/index.html',
  '.well-known/openapi.json',
]);

const QUOTATION_TEMPLATE = Object.freeze({
  name: 'quotation_ready',
  language: 'en',
});
const TEST_SEND_CONFIRMATION = 'SEND_ONE_WANAMASTE_TEST';
const REDACTED = '[REDACTED]';
const SENSITIVE_RESPONSE_KEYS = new Set([
  'authorization',
  'api_token',
  'access_token',
  'token',
  'phone',
  'phone_number',
  'recipient',
  'customer_name',
  'quotation_number',
  'header_document',
  'header_document_name',
  'field_1',
  'field_2',
]);

function validationError(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.field = field;
  return error;
}

function isPrivateOrLocalHostname(hostname) {
  const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.lan')
  ) return true;

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) {
    const [first, second] = normalized.split('.').map(Number);
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }
  if (ipVersion === 6) {
    return normalized === '::'
      || normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith('::ffff:127.')
      || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }

  return !normalized.includes('.');
}

function validateConfiguration(config = env.wanamaste) {
  const errors = [];
  let baseUrl = null;

  if (!config.apiBaseUrl) errors.push('WANAMASTE_API_BASE_URL is not configured.');
  if (!config.vendorUid) errors.push('WANAMASTE_VENDOR_UID is not configured.');
  if (!config.apiToken) errors.push('WANAMASTE_API_TOKEN is not configured.');

  if (config.apiBaseUrl) {
    try {
      baseUrl = new URL(config.apiBaseUrl);
      const hostname = baseUrl.hostname.toLowerCase();
      if (baseUrl.protocol !== 'https:') errors.push('WANAMASTE_API_BASE_URL must use HTTPS.');
      if (isPrivateOrLocalHostname(hostname)) {
        errors.push('WANAMASTE_API_BASE_URL must not target a local or private address.');
      }
    } catch (_error) {
      errors.push('WANAMASTE_API_BASE_URL must be a valid absolute URL.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    baseUrl,
    configured: {
      apiBaseUrl: Boolean(config.apiBaseUrl),
      vendorUid: Boolean(config.vendorUid),
      apiToken: Boolean(config.apiToken),
    },
  };
}

function documentationUrl(baseUrl, path) {
  const normalizedBase = baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`;
  return new URL(path, normalizedBase);
}

function requiredString(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) throw validationError(`${fieldName} is required.`, fieldName);
  return normalized;
}

function publicHttpsUrl(value, fieldName) {
  const normalized = requiredString(value, fieldName);
  let url;
  try {
    url = new URL(normalized);
  } catch (_error) {
    throw validationError(`${fieldName} must be a valid absolute URL.`, fieldName);
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || isPrivateOrLocalHostname(hostname)) {
    throw validationError(`${fieldName} must be a public HTTPS URL.`, fieldName);
  }
  return url.href;
}

function buildQuotationTemplateRequest({
  config = env.wanamaste,
  phoneNumber,
  customerName,
  quotationNumber,
  documentUrl,
  documentName,
  fromPhoneNumberId,
} = {}) {
  const validation = validateConfiguration(config);
  if (!validation.valid || !validation.baseUrl) {
    throw validationError(`WAnamaste configuration is invalid: ${validation.errors.join(' ')}`, 'configuration');
  }

  const recipient = requiredString(phoneNumber, 'phoneNumber');
  if (!/^[1-9]\d+$/.test(recipient)) {
    throw validationError(
      'phoneNumber must include the country code without a leading + or 0.',
      'phoneNumber',
    );
  }

  const baseUrl = validation.baseUrl.href.replace(/\/+$/, '');
  const vendorUid = encodeURIComponent(requiredString(config.vendorUid, 'WANAMASTE_VENDOR_UID'));
  const body = {
    phone_number: recipient,
    template_name: QUOTATION_TEMPLATE.name,
    template_language: QUOTATION_TEMPLATE.language,
    header_document: publicHttpsUrl(documentUrl, 'documentUrl'),
    header_document_name: requiredString(documentName, 'documentName'),
    field_1: requiredString(customerName, 'customerName'),
    field_2: requiredString(quotationNumber, 'quotationNumber'),
  };

  if (fromPhoneNumberId !== undefined && fromPhoneNumberId !== null && String(fromPhoneNumberId).trim()) {
    body.from_phone_number_id = String(fromPhoneNumberId).trim();
  }

  return {
    url: `${baseUrl}/${vendorUid}/contact/send-template-message`,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body,
  };
}

function redactText(value, sensitiveValues) {
  let sanitized = String(value || '').replace(/Bearer\s+[^\s"']+/gi, `Bearer ${REDACTED}`);
  sensitiveValues
    .filter((item) => item && item.length >= 3)
    .sort((left, right) => right.length - left.length)
    .forEach((item) => {
      sanitized = sanitized.split(item).join(REDACTED);
    });
  return sanitized;
}

function sanitizeProviderValue(value, sensitiveValues, depth = 0) {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') return redactText(value, sensitiveValues).slice(0, 4096);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeProviderValue(item, sensitiveValues, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).slice(0, 100).map(([key, childValue]) => [
      key,
      SENSITIVE_RESPONSE_KEYS.has(key.toLowerCase())
        ? REDACTED
        : sanitizeProviderValue(childValue, sensitiveValues, depth + 1),
    ]),
  );
}

async function sanitizedResponseBody(response, sensitiveValues) {
  const rawBody = await response.text();
  if (!rawBody) return null;

  try {
    return sanitizeProviderValue(JSON.parse(rawBody), sensitiveValues);
  } catch (_error) {
    return redactText(rawBody, sensitiveValues).slice(0, 4096);
  }
}

async function sendControlledTestQuotation({
  confirmation,
  phoneNumber,
  customerName,
  quotationNumber,
  documentUrl,
  documentName = 'quotation.pdf',
  fromPhoneNumberId,
} = {}, {
  config = env.wanamaste,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
} = {}) {
  if (confirmation !== TEST_SEND_CONFIRMATION) {
    throw validationError(
      `confirmation must equal ${TEST_SEND_CONFIRMATION}.`,
      'confirmation',
    );
  }

  const request = buildQuotationTemplateRequest({
    config,
    phoneNumber,
    customerName,
    quotationNumber,
    documentUrl,
    documentName,
    fromPhoneNumberId,
  });
  const sensitiveValues = [
    config.apiToken,
    request.headers.Authorization,
    phoneNumber,
    customerName,
    quotationNumber,
    documentUrl,
    documentName,
  ].map((value) => String(value || ''));

  let response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      httpStatus: null,
      success: false,
      responseBody: null,
      failureCode: networkFailureCode(error),
    };
  }

  return {
    httpStatus: response.status,
    success: response.ok,
    responseBody: await sanitizedResponseBody(response, sensitiveValues),
    failureCode: response.ok ? null : 'PROVIDER_REJECTED',
  };
}

function describeSecuritySchemes(document) {
  const schemes = document?.components?.securitySchemes || document?.securityDefinitions || {};
  return Object.values(schemes).map((scheme) => {
    const type = String(scheme?.type || 'unknown');
    const location = scheme?.in ? `:${scheme.in}` : '';
    const authScheme = scheme?.scheme ? `:${scheme.scheme}` : '';
    return `${type}${location}${authScheme}`;
  });
}

function publicPaths(document) {
  return Object.entries(document?.paths || {}).flatMap(([path, methods]) => (
    Object.keys(methods || {})
      .filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase()))
      .map((method) => `${method.toUpperCase()} ${path}`)
  ));
}

function htmlMetadata(html, pageUrl, baseUrl) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const links = [];
  const linkPattern = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = linkPattern.exec(html)) && links.length < 25) {
    try {
      const url = new URL(match[1], pageUrl);
      const relevant = /(api|docs?|openapi|swagger)/i.test(url.pathname);
      if (url.origin === baseUrl.origin && relevant && !links.includes(url.pathname)) {
        links.push(url.pathname);
      }
    } catch (_error) {
      // Ignore malformed page links.
    }
  }
  return { title, links };
}

function networkFailureCode(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'TIMEOUT';
  const code = String(error?.cause?.code || error?.code || '').toUpperCase();
  if (code.includes('CERT') || code.includes('TLS')) return 'TLS_ERROR';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_ERROR';
  return 'NETWORK_ERROR';
}

async function inspectConnection({
  config = env.wanamaste,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
} = {}) {
  const validation = validateConfiguration(config);
  const result = {
    configuration: {
      valid: validation.valid,
      configured: validation.configured,
      errors: validation.errors,
    },
    connectivity: {
      attempted: false,
      reachable: false,
      httpStatus: null,
      failureCode: null,
    },
    documentation: {
      openApiFound: false,
      sourcePath: null,
      endpoints: [],
      securitySchemes: [],
      publicPageMetadata: [],
      candidateLinks: [],
    },
    credentialValidation: {
      attempted: false,
      authenticated: null,
      reason: 'No documented non-sending authentication endpoint has been identified.',
    },
  };

  if (!validation.valid || !validation.baseUrl) return result;

  for (const path of DOCUMENTATION_PATHS) {
    try {
      const response = await fetchImpl(documentationUrl(validation.baseUrl, path), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'application/json, application/yaml, text/html;q=0.8',
          'User-Agent': 'SS-Bricks-WAnamaste-Connection-Check/1.0',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      result.connectivity.attempted = true;
      result.connectivity.reachable = true;
      if (result.connectivity.httpStatus === null) result.connectivity.httpStatus = response.status;

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) continue;

      if (contentType.includes('html')) {
        const html = (await response.text()).slice(0, 262144);
        const metadata = htmlMetadata(html, response.url || documentationUrl(validation.baseUrl, path), validation.baseUrl);
        result.documentation.publicPageMetadata.push({
          path: path || '/',
          status: response.status,
          title: metadata.title,
        });
        metadata.links.forEach((link) => {
          if (!result.documentation.candidateLinks.includes(link)) {
            result.documentation.candidateLinks.push(link);
          }
        });
        continue;
      }
      if (!contentType.includes('json')) continue;

      const document = await response.json().catch(() => null);
      if (!document || (!document.openapi && !document.swagger) || !document.paths) continue;

      result.documentation = {
        openApiFound: true,
        sourcePath: path || '/',
        endpoints: publicPaths(document),
        securitySchemes: describeSecuritySchemes(document),
        publicPageMetadata: result.documentation.publicPageMetadata,
        candidateLinks: result.documentation.candidateLinks,
      };
      break;
    } catch (error) {
      result.connectivity.attempted = true;
      if (!result.connectivity.failureCode) {
        result.connectivity.failureCode = networkFailureCode(error);
      }
    }
  }

  return result;
}

module.exports = {
  DOCUMENTATION_PATHS,
  QUOTATION_TEMPLATE,
  TEST_SEND_CONFIRMATION,
  buildQuotationTemplateRequest,
  htmlMetadata,
  inspectConnection,
  sendControlledTestQuotation,
  validateConfiguration,
};
