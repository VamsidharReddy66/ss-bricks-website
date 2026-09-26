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
      const privateIpv4 = net.isIP(hostname) === 4 && (
        hostname.startsWith('10.')
        || hostname.startsWith('127.')
        || hostname.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
      );
      if (baseUrl.protocol !== 'https:') errors.push('WANAMASTE_API_BASE_URL must use HTTPS.');
      if (hostname === 'localhost' || hostname === '::1' || privateIpv4) {
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
  htmlMetadata,
  inspectConnection,
  validateConfiguration,
};
