const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TEST_SEND_CONFIRMATION,
  buildQuotationTemplateRequest,
  htmlMetadata,
  inspectConnection,
  sendControlledTestQuotation,
  validateConfiguration,
} = require('../services/wanamasteService');

const configured = {
  apiBaseUrl: 'https://api.example.test/v1',
  vendorUid: 'vendor-secret-value',
  apiToken: 'token-secret-value',
};

test('validates WAnamaste configuration without returning credential values', () => {
  const result = validateConfiguration(configured);
  assert.equal(result.valid, true);
  assert.deepEqual(result.configured, {
    apiBaseUrl: true,
    vendorUid: true,
    apiToken: true,
  });
  assert.equal(JSON.stringify(result).includes(configured.vendorUid), false);
  assert.equal(JSON.stringify(result).includes(configured.apiToken), false);
});

test('discovers endpoint and authentication metadata from OpenAPI without credentials', async () => {
  const requests = [];
  const openApi = {
    openapi: '3.0.0',
    components: {
      securitySchemes: {
        apiToken: { type: 'http', scheme: 'bearer' },
      },
    },
    paths: {
      '/vendors/{vendorUid}/messages': { post: {} },
      '/vendors/{vendorUid}/documents': { post: {} },
    },
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    const isOpenApi = String(url).endsWith('/openapi.json');
    return new Response(isOpenApi ? JSON.stringify(openApi) : 'not found', {
      status: isOpenApi ? 200 : 404,
      headers: { 'content-type': isOpenApi ? 'application/json' : 'text/plain' },
    });
  };

  const result = await inspectConnection({ config: configured, fetchImpl });
  assert.equal(result.connectivity.reachable, true);
  assert.equal(result.documentation.openApiFound, true);
  assert.deepEqual(result.documentation.endpoints, [
    'POST /vendors/{vendorUid}/messages',
    'POST /vendors/{vendorUid}/documents',
  ]);
  assert.deepEqual(result.documentation.securitySchemes, ['http:bearer']);
  assert.equal(result.credentialValidation.attempted, false);
  assert.equal(requests.some(({ options }) => options.headers.Authorization), false);
  assert.equal(JSON.stringify(result).includes(configured.apiToken), false);
});

test('returns a sanitized network failure without exposing the configured URL', async () => {
  const result = await inspectConnection({
    config: configured,
    fetchImpl: async () => {
      const error = new Error(`Could not reach ${configured.apiBaseUrl}?token=${configured.apiToken}`);
      error.cause = { code: 'ENOTFOUND' };
      throw error;
    },
  });

  assert.equal(result.connectivity.reachable, false);
  assert.equal(result.connectivity.failureCode, 'DNS_ERROR');
  assert.equal(JSON.stringify(result).includes(configured.apiBaseUrl), false);
  assert.equal(JSON.stringify(result).includes(configured.apiToken), false);
});

test('extracts only same-origin documentation links from public HTML', () => {
  const metadata = htmlMetadata(`
    <html><head><title> WAnamaste API </title></head><body>
      <a href="/docs/api">API docs</a>
      <a href="https://external.example/openapi.json">External</a>
      <a href="/account">Account</a>
    </body></html>
  `, new URL('https://api.example.test/'), new URL('https://api.example.test/'));

  assert.equal(metadata.title, 'WAnamaste API');
  assert.deepEqual(metadata.links, ['/docs/api']);
});

test('builds the documented WAnamaste quotation template request without executing it', () => {
  const request = buildQuotationTemplateRequest({
    config: {
      apiBaseUrl: 'https://wanamaste.in/api',
      vendorUid: 'vendor-test-uid',
      apiToken: 'test-token-not-a-secret',
    },
    phoneNumber: '919876543210',
    customerName: 'Anita Builders',
    quotationNumber: 'SSB-Q-2026-0042',
    documentUrl: 'https://quotes.example.com/SSB-Q-2026-0042.pdf',
    documentName: 'SSB-Q-2026-0042.pdf',
  });

  assert.deepEqual(request, {
    url: 'https://wanamaste.in/api/vendor-test-uid/contact/send-template-message',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer test-token-not-a-secret',
      'Content-Type': 'application/json',
    },
    body: {
      phone_number: '919876543210',
      template_name: 'quotation_ready',
      template_language: 'en',
      header_document: 'https://quotes.example.com/SSB-Q-2026-0042.pdf',
      header_document_name: 'SSB-Q-2026-0042.pdf',
      field_1: 'Anita Builders',
      field_2: 'SSB-Q-2026-0042',
    },
  });
  assert.equal(request.url.includes('test-token-not-a-secret'), false);
  assert.equal(JSON.stringify(request.body).includes('test-token-not-a-secret'), false);
});

test('includes the documented optional source phone number id when supplied', () => {
  const request = buildQuotationTemplateRequest({
    config: {
      apiBaseUrl: 'https://wanamaste.in/api/',
      vendorUid: 'vendor/uid',
      apiToken: 'test-token',
    },
    phoneNumber: '919876543210',
    customerName: 'Anita Builders',
    quotationNumber: 'SSB-Q-42',
    documentUrl: 'https://quotes.example.com/quote.pdf',
    documentName: 'quote.pdf',
    fromPhoneNumberId: '1234567890',
  });

  assert.equal(request.url, 'https://wanamaste.in/api/vendor%2Fuid/contact/send-template-message');
  assert.equal(request.body.from_phone_number_id, '1234567890');
});

test('rejects undocumented recipient and document URL formats', () => {
  const baseInput = {
    config: {
      apiBaseUrl: 'https://wanamaste.in/api',
      vendorUid: 'vendor-test-uid',
      apiToken: 'test-token',
    },
    phoneNumber: '919876543210',
    customerName: 'Anita Builders',
    quotationNumber: 'SSB-Q-42',
    documentUrl: 'https://quotes.example.com/quote.pdf',
    documentName: 'quote.pdf',
  };

  assert.throws(
    () => buildQuotationTemplateRequest({ ...baseInput, phoneNumber: '+919876543210' }),
    /without a leading \+ or 0/,
  );
  assert.throws(
    () => buildQuotationTemplateRequest({ ...baseInput, documentUrl: 'http://localhost/quote.pdf' }),
    /public HTTPS URL/,
  );
});

const validTestSend = {
  confirmation: TEST_SEND_CONFIRMATION,
  phoneNumber: '919876543210',
  customerName: 'Test Customer',
  quotationNumber: 'TEST-Q-001',
  documentUrl: 'https://quotes.example.com/test-quotation.pdf',
  documentName: 'quotation.pdf',
};

test('executes exactly one documented API request for an explicitly confirmed manual test', async () => {
  const calls = [];
  const result = await sendControlledTestQuotation(validTestSend, {
    config: configured,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ status: 'queued', message_id: 'test-message-id' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.test/v1/vendor-secret-value/contact/send-template-message');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${configured.apiToken}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    phone_number: '919876543210',
    template_name: 'quotation_ready',
    template_language: 'en',
    header_document: 'https://quotes.example.com/test-quotation.pdf',
    header_document_name: 'quotation.pdf',
    field_1: 'Test Customer',
    field_2: 'TEST-Q-001',
  });
  assert.deepEqual(result, {
    httpStatus: 202,
    success: true,
    responseBody: { status: 'queued', message_id: 'test-message-id' },
    failureCode: null,
  });
});

test('requires the explicit test-send confirmation before any API call', async () => {
  let callCount = 0;
  await assert.rejects(
    sendControlledTestQuotation({ ...validTestSend, confirmation: true }, {
      config: configured,
      fetchImpl: async () => {
        callCount += 1;
      },
    }),
    /confirmation must equal SEND_ONE_WANAMASTE_TEST/,
  );
  assert.equal(callCount, 0);
});

test('rejects invalid test recipient phone numbers without calling WAnamaste', async () => {
  let callCount = 0;
  for (const phoneNumber of ['+919876543210', '09876543210', '91 98765 43210', 'phone']) {
    await assert.rejects(
      sendControlledTestQuotation({ ...validTestSend, phoneNumber }, {
        config: configured,
        fetchImpl: async () => { callCount += 1; },
      }),
      /without a leading \+ or 0/,
    );
  }
  assert.equal(callCount, 0);
});

test('rejects invalid, HTTP, localhost, and private PDF URLs without an API call', async () => {
  let callCount = 0;
  const invalidUrls = [
    'not-a-url',
    'http://quotes.example.com/quotation.pdf',
    'https://localhost/quotation.pdf',
    'https://127.0.0.1/quotation.pdf',
    'https://192.168.1.5/quotation.pdf',
    'https://169.254.10.20/quotation.pdf',
    'https://[::1]/quotation.pdf',
    'https://files.internal/quotation.pdf',
  ];

  for (const documentUrl of invalidUrls) {
    await assert.rejects(
      sendControlledTestQuotation({ ...validTestSend, documentUrl }, {
        config: configured,
        fetchImpl: async () => { callCount += 1; },
      }),
      /valid absolute URL|public HTTPS URL/,
    );
  }
  assert.equal(callCount, 0);
});

test('rejects missing template data without calling WAnamaste', async () => {
  let callCount = 0;
  for (const field of ['phoneNumber', 'customerName', 'quotationNumber', 'documentUrl']) {
    await assert.rejects(
      sendControlledTestQuotation({ ...validTestSend, [field]: '' }, {
        config: configured,
        fetchImpl: async () => { callCount += 1; },
      }),
      /is required/,
    );
  }
  assert.equal(callCount, 0);
});

test('redacts credentials and test data from provider responses without logging them', async () => {
  const capturedLogs = [];
  const originalConsole = {
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn,
  };
  Object.keys(originalConsole).forEach((method) => {
    console[method] = (...args) => capturedLogs.push(args.join(' '));
  });

  try {
    const result = await sendControlledTestQuotation(validTestSend, {
      config: configured,
      fetchImpl: async () => new Response(JSON.stringify({
        authorization: `Bearer ${configured.apiToken}`,
        token: configured.apiToken,
        phone_number: validTestSend.phoneNumber,
        field_1: validTestSend.customerName,
        field_2: validTestSend.quotationNumber,
        header_document: validTestSend.documentUrl,
        error: `Rejected Bearer ${configured.apiToken} for ${validTestSend.phoneNumber}`,
      }), { status: 400, headers: { 'content-type': 'application/json' } }),
    });

    const serialized = JSON.stringify(result);
    assert.equal(result.success, false);
    assert.equal(result.httpStatus, 400);
    assert.equal(serialized.includes(configured.apiToken), false);
    assert.equal(serialized.includes(validTestSend.phoneNumber), false);
    assert.equal(serialized.includes(validTestSend.customerName), false);
    assert.equal(serialized.includes(validTestSend.quotationNumber), false);
    assert.equal(serialized.includes(validTestSend.documentUrl), false);
    assert.equal(capturedLogs.length, 0);
  } finally {
    Object.entries(originalConsole).forEach(([method, implementation]) => {
      console[method] = implementation;
    });
  }
});
