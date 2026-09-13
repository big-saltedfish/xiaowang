import test from 'node:test';
import assert from 'node:assert/strict';
import {
  researchTemplate,
  scheduleInput,
  RESEARCH_SYSTEM,
  parsePreferences,
  savePreferences,
  saveDelivery,
  restoreWorkspace,
  runNeedsRefresh,
} from '../lib/workflow.ts';
import { parseTarget } from '../lib/qca.ts';
void test('research template references three MCP servers and a vault without serializing the secret', () => {
  const t = researchTemplate({
    environment: 'env_a',
    vault: 'vault_a',
    skill: 'skill_a',
    model: 'ultimate',
  });
  assert.equal(t.mcp_servers.length, 3);
  assert.deepEqual(t.vaults, { vault_a: { enabled: true } });
  assert.ok(t.managed_tool_config.enabled_tools.includes('drive'));
  assert.ok(!JSON.stringify(t).includes('auth_token'));
});
void test('daily task uses new sessions, one cloud run at a time and the actual IM target', () => {
  const r = scheduleInput(
    { identity: 'idn_a', template: 'tmpl_a', environment: 'env_a' },
    { watchlist: '600519,300750', time: '15:30', frequency: 'weekdays' },
    {
      channel: 'channel_a',
      target: { type: 'user', external_id: 'opaque-123' },
    },
  );
  assert.deepEqual(r.trigger_policy, {
    type: 'cron',
    expression: '30 15 * * 1-5',
    timezone: 'Asia/Shanghai',
  });
  assert.equal(r.execution.session_mode, 'new_session');
  assert.equal(r.execution.max_concurrent_runs, 1);
  assert.equal(r.sinks[0].target.external_id, 'opaque-123');
});
void test('malformed time and oversized watchlist cannot become a schedule', () => {
  assert.throws(() =>
    parsePreferences({
      time: '25:90',
      watchlist: '600519',
      frequency: 'daily',
    }),
  );
  assert.throws(() =>
    parsePreferences({
      time: '15:30',
      watchlist: 'x'.repeat(1000),
      frequency: 'daily',
    }),
  );
});
void test('notification target requires a native opaque ID, not a nickname', () => {
  assert.deepEqual(
    parseTarget('{"target":{"type":"user","external_id":"abc"}}'),
    { type: 'user', external_id: 'abc' },
  );
  assert.throws(() => parseTarget('我的微信'));
});
void test('system contract protects preferences and requires persistent evidence', () => {
  for (const s of ['Drive', 'DeliverArtifacts', '候选', '用户', '记忆'])
    assert.ok(RESEARCH_SYSTEM.includes(s));
});

const ws = {
  identity: {
    id: 'idn_a',
    external_id: 'watchtower-v1',
    enabled: true,
    metadata: {
      wt_schedule: 'sched_a',
      wt_template: 'tmpl_a',
      wt_environment: 'env_a',
      wt_store: 'store_a',
      wt_preferences: JSON.stringify({
        watchlist: 'old',
        time: '09:00',
        frequency: 'daily',
      }),
    },
  },
  resources: {
    schedule: 'sched_a',
    template: 'tmpl_a',
    environment: 'env_a',
    store: 'store_a',
  },
  preferences: { watchlist: 'old', time: '09:00', frequency: 'daily' },
};
void test('plan updates persist atomically in Schedule and never overwrite freeform user memory', async () => {
  const calls = [];
  const api = {
    request: async (method, path, body) => {
      calls.push({ method, path, body });
      return { ...body, id: 'sched_a' };
    },
  };
  const prefs = { watchlist: 'new', time: '15:30', frequency: 'weekdays' };
  const updated = await savePreferences(api, ws, prefs);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/schedules/sched_a');
  assert.equal(calls[0].body.identity_id, undefined);
  assert.equal(calls[0].body.sinks, undefined);
  assert.deepEqual(updated.preferences, prefs);
  assert.deepEqual(JSON.parse(calls[0].body.metadata.wt_preferences), prefs);
});
void test('notification target changes only sinks without replacing research preferences', async () => {
  const prefs = {
    watchlist: 'cloud-current',
    time: '16:00',
    frequency: 'daily',
  };
  const calls = [];
  const api = {
    request: async (method, path, body) => {
      calls.push(body);
      return {
        id: 'sched_a',
        metadata: { wt_preferences: JSON.stringify(prefs) },
        ...body,
      };
    },
  };
  const updated = await saveDelivery(api, ws, {
    channel: 'channel_a',
    target: { type: 'user', external_id: 'opaque' },
  });
  assert.deepEqual(Object.keys(calls[0]), ['sinks']);
  assert.deepEqual(updated.preferences, ws.preferences);
  assert.equal(
    JSON.parse(updated.identity.metadata.wt_target).external_id,
    'opaque',
  );
});
void test('reconnect reads the actual Schedule after an update whose response was lost', async () => {
  const prefs = {
    watchlist: 'saved-before-disconnect',
    time: '16:30',
    frequency: 'weekdays',
  };
  const api = {
    list: async () => [ws.identity],
    request: async () => ({
      id: 'sched_a',
      metadata: { wt_preferences: JSON.stringify(prefs) },
      sinks: [],
    }),
  };
  const recovered = await restoreWorkspace(api);
  assert.deepEqual(recovered.preferences, prefs);
  assert.equal(recovered.identity.metadata.wt_target, '');
});
void test('completed research keeps refreshing until IM delivery reaches its own terminal status', () => {
  assert.equal(
    runNeedsRefresh({ status: 'completed', push_status: 'pending' }),
    true,
  );
  assert.equal(
    runNeedsRefresh({ status: 'completed', push_status: 'succeeded' }),
    false,
  );
  assert.equal(
    runNeedsRefresh({ status: 'failed', push_status: 'failed' }),
    false,
  );
  assert.equal(
    runNeedsRefresh({ status: 'running', push_status: 'skipped' }),
    true,
  );
});
void test('saving a loop notification target preserves current research preferences', async () => {
  const workspace = {
    ...ws,
    resources: { ...ws.resources, deliverySchedule: 'sched_delivery' },
    preferences: { watchlist: 'current', time: '10:00', frequency: 'daily' },
  };
  const api = {
    request: async (_method, path, body) => {
      assert.ok(['/schedules/sched_delivery', `/schedules/${workspace.resources.schedule}`].includes(path));
      return {
        id: 'sched_delivery',
        metadata: {
          wt_preferences: JSON.stringify({
            watchlist: 'stale',
            time: '09:00',
            frequency: 'weekdays',
          }),
        },
        ...body,
      };
    },
  };
  const updated = await saveDelivery(api, workspace, {
    channel: 'channel_a',
    target: { type: 'user', external_id: 'opaque' },
  });
  assert.deepEqual(updated.preferences, workspace.preferences);
});
