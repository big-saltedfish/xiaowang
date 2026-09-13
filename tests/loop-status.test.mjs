import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecurring, methodStatus, MEMORY_PROTOCOL } from '../lib/loop-status.ts';

test('an exhausted one-shot schedule is never an enabled daily loop', () => {
  assert.equal(isRecurring({status:'active',trigger_policy:{type:'once',upcoming_runs_at:[]}}), false);
  assert.equal(isRecurring({status:'active',trigger_policy:{type:'cron'}}), true);
  assert.equal(isRecurring({status:'paused',trigger_policy:{type:'cron'}}), false);
});
test('baseline and missing evidence do not masquerade as validated evolution', () => {
  assert.match(methodStatus(null), /尚无方法记录/);
  assert.match(methodStatus({status:'baseline',version:1}), /基线/);
  assert.match(methodStatus({status:'trial'}), /待下轮验证/);
  assert.match(MEMORY_PROTOCOL, /\/data\/\.qoder\/awareness\//);
  assert.match(MEMORY_PROTOCOL, /Drive/);
});
