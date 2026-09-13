import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../server/proxy.mjs';

async function withServer(upstream, run) {
  const server = createServer(createHandler({ fetcher: upstream }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
void test('same-origin API forwards auth, query and idempotency only to the selected QCA region', async () => {
  let captured;
  await withServer(
    async (url, init) => {
      captured = { url, init };
      return Response.json({ id: 'sched_a' });
    },
    async (base) => {
      const response = await fetch(base + '/api/qca/cn/schedules?limit=10', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'one-op',
          Cookie: 'private-cookie',
        },
        body: '{"name":"research"}',
      });
      assert.equal(response.status, 200);
      assert.equal(
        captured.url,
        'https://api.qoder.com.cn/api/v1/forward/schedules?limit=10',
      );
      assert.equal(captured.init.headers.Authorization, 'Bearer test-key');
      assert.equal(captured.init.headers['Idempotency-Key'], 'one-op');
      assert.equal(captured.init.headers.Cookie, undefined);
      assert.equal(captured.init.body.toString(), '{"name":"research"}');
    },
  );
});
void test('multipart skill bytes and boundary survive forwarding', async () => {
  await withServer(
    async (url, init) => {
      assert.match(url, /\/skills$/);
      assert.match(
        init.headers['Content-Type'],
        /^multipart\/form-data; boundary=/,
      );
      assert.ok(init.body.includes(Buffer.from('zip-content')));
      return Response.json({ id: 'skill_a' });
    },
    async (base) => {
      const form = new FormData();
      form.append('files', new Blob(['zip-content']), 'skill.zip');
      assert.equal(
        (
          await fetch(base + '/api/qca/global/skills', {
            method: 'POST',
            headers: { Authorization: 'Bearer test' },
            body: form,
          })
        ).status,
        200,
      );
    },
  );
});
void test('bad region, encoded traversal and cross-origin requests never reach QCA', async () => {
  await withServer(
    async () => {
      throw new Error('must not call');
    },
    async (base) => {
      for (const path of [
        '/api/qca/evil/models',
        '/api/qca/cn/templates/%252e%252e/private',
      ])
        assert.equal(
          (
            await fetch(base + path, {
              headers: { Authorization: 'Bearer test' },
            })
          ).status,
          400,
        );
      assert.equal(
        (
          await fetch(base + '/api/qca/cn/models', {
            headers: {
              Authorization: 'Bearer test',
              Origin: 'https://evil.example',
            },
          })
        ).status,
        403,
      );
      assert.equal((await fetch(base + '/api/qca/cn/models')).status, 401);
    },
  );
});
void test('upstream error status is preserved but response cannot echo secrets', async () => {
  await withServer(
    async () =>
      Response.json(
        { error: { message: 'Bearer test-key', code: 'bad_token' } },
        { status: 401 },
      ),
    async (base) => {
      const response = await fetch(base + '/api/qca/cn/models', {
        headers: { Authorization: 'Bearer test-key' },
      });
      assert.equal(response.status, 401);
      assert.ok(!(await response.text()).includes('test-key'));
    },
  );
});
void test('Drive preview obtains its own signed URL and never sends PAT to storage', async () => {
  const requests = [];
  await withServer(
    async (url, init) => {
      requests.push({ url, init });
      return requests.length === 1
        ? Response.json({
            url: 'https://reports.oss-cn-hangzhou.aliyuncs.com/report.md?signature=x',
            method: 'GET',
            headers: {},
          })
        : new Response('# report');
    },
    async (base) => {
      const response = await fetch(
        base +
          '/api/qca/cn/_drive_preview?identity_id=idn_a&path=reports%2Fa.md',
        { headers: { Authorization: 'Bearer test-key' } },
      );
      assert.equal(await response.text(), '# report');
      assert.equal(requests[1].init.headers.Authorization, undefined);
      assert.ok(!requests[1].url.includes('test-key'));
    },
  );
});
void test('Drive preview rejects a private or arbitrary destination returned upstream', async () => {
  let calls = 0;
  await withServer(
    async () => {
      calls++;
      return Response.json({ url: 'https://127.0.0.1/secret', method: 'GET' });
    },
    async (base) => {
      assert.equal(
        (
          await fetch(
            base +
              '/api/qca/cn/_drive_preview?identity_id=idn_a&path=reports%2Fa.md',
            { headers: { Authorization: 'Bearer test' } },
          )
        ).status,
        502,
      );
      assert.equal(calls, 1);
    },
  );
});
