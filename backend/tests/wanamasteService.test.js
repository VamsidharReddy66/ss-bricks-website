const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inspectConnection,
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
