import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const BASES = {
  cn: 'https://api.qoder.com.cn/api/v1/forward',
  global: 'https://api.qoder.com/api/v1/forward',
};
const MAX_BODY = 8 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
  '.md': 'text/plain; charset=utf-8',
};
class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
function fail(res, status, code) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: { code } }));
}
async function limitedResponse(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new HttpError(413, 'response_too_large');
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, 'response_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
async function requestBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY)
    throw new HttpError(413, 'request_too_large');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function storageAllowed(url) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    (!url.port || url.port === '443') &&
    ['.aliyuncs.com', '.amazonaws.com', '.qoder.com', '.qoder.com.cn'].some(
      (suffix) => url.hostname.endsWith(suffix),
    )
  );
}
export function createHandler({
  fetcher = fetch,
  staticRoot,
  voiceEnabled = false,
} = {}) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        return res.end(
          JSON.stringify({ voiceRealtimeProxy: { enabled: voiceEnabled } }),
        );
      }
      if (!url.pathname.startsWith('/api/')) {
        if (!staticRoot || !['GET', 'HEAD'].includes(req.method))
          return fail(res, 404, 'not_found');
        const pathname = decodeURIComponent(url.pathname);
        const root = resolve(staticRoot);
        const file = resolve(
          root,
          '.' + (pathname === '/' ? '/index.html' : pathname),
        );
        if (!file.startsWith(root + sep)) return fail(res, 404, 'not_found');
        let content;
        try {
          content = await readFile(file);
        } catch {
          return fail(res, 404, 'not_found');
        }
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      // The proxy accepts only same-origin browser requests and fixed QCA destinations.
      if (
        req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host)
      )
        throw new HttpError(403, 'origin_rejected');
      const match = /^\/api\/qca\/(cn|global)(\/.*)$/.exec(url.pathname);
      if (
        !match ||
        !/^\/(?:[A-Za-z0-9_.-]+\/?)+$/.test(match[2]) ||
        match[2].split('/').some((p) => p === '.' || p === '..')
      )
        throw new HttpError(400, 'invalid_proxy_path');
      if (!['GET', 'POST'].includes(req.method))
        throw new HttpError(405, 'method_not_allowed');
      const auth = req.headers.authorization;
      if (!auth || !/^Bearer [^\r\n]+$/.test(auth))
        throw new HttpError(401, 'authentication_required');
      const [, region, path] = match;
      const headers = { Authorization: auth, Accept: 'application/json' };
      const options = {
        method: req.method,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(40000),
      };
      if (path === '/_drive_preview') {
        if (req.method !== 'GET')
          throw new HttpError(405, 'method_not_allowed');
        const identity = url.searchParams.get('identity_id'),
          drivePath = url.searchParams.get('path');
        if (!identity || !drivePath)
          throw new HttpError(400, 'missing_drive_path');
        const signed = await fetcher(
          BASES[region] +
            '/drives/download-url?identity_id=' +
            encodeURIComponent(identity),
          {
            ...options,
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: drivePath }),
          },
        );
        if (!signed.ok)
          throw new HttpError(signed.status, 'download_url_failed');
        const file = JSON.parse(
          (await limitedResponse(signed, 65536)).toString(),
        );
        const storage = new URL(file.url);
        if (
          file.method !== 'GET' ||
          !storageAllowed(storage) ||
          file.url.includes(auth.slice(7))
        )
          throw new HttpError(502, 'invalid_storage_destination');
        const storageHeaders = file.headers || {};
        if (
          Object.entries(storageHeaders).some(
            ([k, v]) =>
              ['authorization', 'cookie', 'host'].includes(k.toLowerCase()) ||
              String(v).includes(auth.slice(7)),
          )
        )
          throw new HttpError(502, 'invalid_storage_headers');
        const response = await fetcher(storage.href, {
          method: 'GET',
          headers: storageHeaders,
          redirect: 'error',
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok)
          throw new HttpError(response.status, 'storage_read_failed');
        const content = await limitedResponse(response, 2 * 1024 * 1024);
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        return res.end(content);
      }
      if (req.headers['content-type'])
        headers['Content-Type'] = req.headers['content-type'];
      if (req.headers['idempotency-key'])
        headers['Idempotency-Key'] = req.headers['idempotency-key'];
      if (req.method === 'POST') options.body = await requestBody(req);
      const response = await fetcher(
        BASES[region] + path + url.search,
        options,
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new HttpError(response.status, 'qca_request_failed');
      }
      if (response.status === 204) {
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        return res.end();
      }
      const content = await limitedResponse(response, MAX_BODY);
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(content);
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      fail(
        res,
        error instanceof HttpError ? error.status : 502,
        error instanceof HttpError ? error.code : 'upstream_unavailable',
      );
    }
  };
}
