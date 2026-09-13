import test from 'node:test';
import assert from 'node:assert/strict';
import { QcaClient } from '../lib/qca.ts';
import { bootstrap } from '../lib/workflow.ts';

function service() {
  let identity, schedule;
  let serial = 0;
  const credentials = [],
    memories = [],
    writes = [],
    cache = new Map();
  let failCheckpoint = false;
  const fetcher = async (url, init = {}) => {
    const u = new URL(url, 'http://localhost'),
      path = u.pathname.replace('/api/qca/cn', ''),
      method = init.method || 'GET';
    const body =
      typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (method === 'GET') {
      if (path === '/identities')
        return Response.json({
          data: identity ? [identity] : [],
          has_more: false,
        });
      if (schedule && path === '/schedules/' + schedule.id)
        return Response.json(schedule);
      if (path === '/models')
        return Response.json({ data: [{ id: 'ultimate', is_enabled: true }] });
      if (path.endsWith('/credentials'))
        return Response.json({ data: credentials, has_more: false });
      if (path.endsWith('/memory_stores'))
        return Response.json({
          data: [
            {
              memory_store_id: 'memstore_1',
              system_managed: true,
              access: 'read_write',
            },
          ],
          has_more: false,
        });
      if (path.endsWith('/memories'))
        return Response.json({ data: memories, has_more: false });
    }
    writes.push({ path, body });
    if (path === '/identities/idn_1') {
      if (failCheckpoint && body.metadata.wt_environment) {
        failCheckpoint = false;
        throw new TypeError('Failed to fetch');
      }
      identity = {
        ...identity,
        metadata: { ...identity.metadata, ...body.metadata },
      };
      return Response.json(identity);
    }
    const key = init.headers['Idempotency-Key'];
    if (key && cache.has(key)) return Response.json(cache.get(key));
    let result;
    if (path === '/identities') {
      identity = { ...body, id: 'idn_1', enabled: true };
      result = identity;
    } else if (path === '/environments') {
      assert.equal(body.config.type, 'cloud');
      result = { id: 'env_' + ++serial };
    } else if (path === '/vaults') {
      assert.ok(body.display_name);
      assert.equal(body.name, undefined);
      result = { id: 'vault_' + ++serial };
    } else if (path.endsWith('/credentials')) {
      assert.equal(body.auth.type, 'static_bearer');
      result = { ...body, id: 'cred_' + ++serial };
      credentials.push(result);
    } else if (/\/credentials\/cred_/.test(path)) {
      const c = credentials.find((c) => path.endsWith('/' + c.id));
      c.auth = { ...c.auth, ...body.auth };
      result = c;
    } else if (path === '/skills') {
      assert.ok(init.body instanceof FormData);
      assert.ok(init.body.get('files'));
      result = { id: 'skill_' + ++serial };
    } else if (path === '/templates') {
      assert.equal(body.mcp_servers.length, 3);
      assert.ok(body.vaults);
      result = { ...body, id: 'tmpl_' + ++serial };
    } else if (path === '/sessions') {
      result = { id: 'sess_' + ++serial };
    } else if (path.endsWith('/memories')) {
      result = { ...body, id: 'mem_' + ++serial };
      memories.push(result);
    } else if (path === '/schedules') {
      assert.deepEqual(body.trigger_policy, { type: 'manual' });
      assert.deepEqual(body.sinks, []);
      result = { ...body, id: 'sched_' + ++serial };
      schedule = result;
    } else throw new Error('Unexpected endpoint ' + path);
    if (key) cache.set(key, result);
    return Response.json(result);
  };
  return {
    fetcher,
    writes,
    credentials,
    get identity() {
      return identity;
    },
    failNextCheckpoint() {
      failCheckpoint = true;
    },
    cache,
  };
}
void test('first setup stores all resource IDs in QCA and keeps the vendor key out of metadata/templates', async () => {
  const server = service(),
    api = new QcaClient('cn', 'pt-test', server.fetcher);
  const ws = await bootstrap(
    api,
    'private-vendor-key',
    new Blob(['zip']),
    () => {},
  );
  for (const name of [
    'environment',
    'vault',
    'template',
    'store',
    'skill',
    'schedule',
  ])
    assert.ok(ws.resources[name]);
  assert.equal(server.credentials.length, 3);
  assert.ok(
    !JSON.stringify(server.identity.metadata).includes('private-vendor-key'),
  );
  assert.ok(
    !JSON.stringify(
      server.writes.find((w) => w.path === '/templates').body,
    ).includes('private-vendor-key'),
  );
});
void test('reconnecting an existing setup does not duplicate resources or replace learned memories', async () => {
  const server = service(),
    api = new QcaClient('cn', 'pt-test', server.fetcher);
  const first = await bootstrap(
    api,
    'private-vendor-key',
    new Blob(['zip']),
    () => {},
  );
  const count = server.writes.length;
  const second = await bootstrap(api, '', new Blob(['zip']), () => {});
  assert.deepEqual(first.resources, second.resources);
  assert.equal(server.writes.length, count);
});
void test('setup interrupted after environment creation can recover its existing cloud resource', async () => {
  const server = service(),
    api = new QcaClient('cn', 'pt-test', server.fetcher);
  server.failNextCheckpoint();
  await assert.rejects(
    bootstrap(api, 'private-vendor-key', new Blob(['zip']), () => {}),
  );
  const result = await bootstrap(
    api,
    'private-vendor-key',
    new Blob(['zip']),
    () => {},
  );
  assert.equal(result.resources.environment, 'env_1');
  assert.equal(
    [...server.cache.keys()].filter((k) => k.endsWith('-environment')).length,
    1,
  );
});

void test('explicit replacement key rotates all three existing credentials without recreating the workspace', async () => {
  const server = service(),
    api = new QcaClient('cn', 'pt-test', server.fetcher);
  const first = await bootstrap(api, 'wrong-key', new Blob(['zip']), () => {});
  const second = await bootstrap(
    api,
    'correct-key',
    new Blob(['zip']),
    () => {},
  );
  assert.deepEqual(first.resources, second.resources);
  assert.equal(server.credentials.length, 3);
  assert.ok(server.credentials.every((c) => c.auth.token === 'correct-key'));
});
