import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleInput, saveDelivery } from '../lib/workflow.ts';

test('WeChat sink can use channel alone without a fabricated target', async () => {
  const payload = scheduleInput({identity:'i',template:'t',environment:'e'}, {watchlist:'600519',time:'09:00',frequency:'weekdays'}, {channel:'c'}, true);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.sinks)), [{type:'im_channel',channel_id:'c'}]);
  const writes=[];
  const api={ request: async (method,path,body) => {writes.push({path,body});return {id:path.split('/').at(-1),...body};}};
  const ws={identity:{id:'i',metadata:{}},resources:{schedule:'morning',deliverySchedule:'evening'},preferences:{}};
  const saved=await saveDelivery(api,ws,{channel:'c'});
  assert.equal(saved.identity.metadata.wt_im_enabled,'true');
  assert.equal(saved.identity.metadata.wt_target,'');
  assert.deepEqual(writes.map(x=>x.path), ['/schedules/evening','/schedules/morning']);
  assert.ok(writes.every(x=>JSON.stringify(x.body)==='{"sinks":[{"type":"im_channel","channel_id":"c"}]}'));
});
