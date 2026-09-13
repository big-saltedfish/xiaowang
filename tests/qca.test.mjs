import test from 'node:test';
import assert from 'node:assert/strict';
import { QcaClient, QcaError } from '../lib/qca.ts';

void test('same-origin proxy uses the chosen QCA region and does not send the key in the URL', async () => {
  let request;
  const api = new QcaClient('cn', 'pt-test', async (url, init) => {
    request = { url, init };
    return Response.json({ data: [] });
  });
  await api.request('GET', '/models');
  assert.equal(request.url, '/api/qca/cn/models');
  assert.equal(request.init.headers.Authorization, 'Bearer pt-test');
  assert.equal(request.init.credentials, 'omit');
});
void test('absolute targets cannot leak the PAT to another host', async () => {
  let called = false;
  const api = new QcaClient('global', 'pt-test', async () => {
    called = true;
    return Response.json({});
  });
  await assert.rejects(api.request('GET', 'https://example.org/steal'));
  await assert.rejects(api.request('GET', '//example.org/steal'));
  assert.equal(called, false);
});
void test('network failure reports proxy connectivity rather than a false authentication failure', async () => {
  const api = new QcaClient('cn', 'pt-test', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    api.request('GET', '/models'),
    (e) =>
      e instanceof QcaError && e.code === 'proxy_unavailable' && e.status === 0,
  );
});
void test('mutation is not retried automatically after ambiguous network failure', async () => {
  let calls = 0;
  const api = new QcaClient('cn', 'pt-test', async () => {
    calls++;
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    api.request('POST', '/schedules', {}, {}, 'same-logical-operation'),
  );
  assert.equal(calls, 1);
});
void test('API errors cannot echo credentials from an upstream message', async () => {
  const api = new QcaClient('cn', 'pt-test', async () =>
    Response.json(
      { error: { code: 'invalid_token', message: 'pt-test' } },
      { status: 401 },
    ),
  );
  await assert.rejects(
    api.request('GET', '/models'),
    (e) => !e.message.includes('pt-test') && e.status === 401,
  );
});
void test('cursor pagination follows last_id and terminates', async () => {
  const urls = [];
  const api = new QcaClient('cn', 'pt-test', async (url) => {
    urls.push(url);
    return Response.json(
      url.includes('after_id')
        ? { data: [{ id: 'b' }], has_more: false }
        : { data: [{ id: 'a' }], last_id: 'a', has_more: true },
    );
  });
  assert.deepEqual(await api.list('/templates'), [{ id: 'a' }, { id: 'b' }]);
  assert.match(urls[1], /after_id=a/);
});
void test('repeating pagination cursor fails instead of looping forever', async () => {
  const api = new QcaClient('cn', 'pt-test', async () =>
    Response.json({ data: [{ id: 'a' }], last_id: 'a', has_more: true }),
  );
  await assert.rejects(api.list('/templates'), /分页/);
});
void test('Drive preview uses the same-origin service without receiving storage URLs', async () => {
  let request;
  const api = new QcaClient('cn', 'pt-test', async (url, init) => {
    request = { url, init };
    return new Response('# report');
  });
  assert.equal(
    await api.readDriveFile('idn_a', 'reports/brief.md'),
    '# report',
  );
  assert.equal(
    request.url,
    '/api/qca/cn/_drive_preview?identity_id=idn_a&path=reports%2Fbrief.md',
  );
  assert.equal(request.init.headers.Authorization, 'Bearer pt-test');
  assert.equal(request.init.credentials, 'omit');
});

void test('native browser fetch keeps its global receiver when stored on the API client', async () => {
  const api = new QcaClient('cn', 'pt-test', function () {
    assert.equal(this, globalThis);
    return Promise.resolve(Response.json({ data: [] }));
  });
  await api.request('GET', '/models');
});
