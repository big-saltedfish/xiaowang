import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLoop,saveLoop} from '../lib/loop.ts';
const base={watchlist:'600519',time:'09:00',reviewTime:'15:40',deliveryTime:'16:10',frequency:'daily',enabled:true};
void test('loop timing rejects overlapping phases before cloud writes',()=>{
 assert.throws(()=>validateLoop({...base,reviewTime:'09:05'}),/20分钟/);
 assert.throws(()=>validateLoop({...base,deliveryTime:'15:45'}),/20分钟/);
 assert.deepEqual(validateLoop(base),base);
});
void test('interrupted multi-plan save leaves recovery intent and does not claim complete',async()=>{
 const writes=[];const ws={identity:{id:'idn_a',metadata:{}},resources:{schedule:'research',reviewSchedule:'review',deliverySchedule:'delivery',template:'template',environment:'env'},preferences:base};
 const api={request:async(method,path,body)=>{writes.push({method,path,body});if(path==='/schedules/review')throw new Error('network interruption');if(path==='/schedules/research')return {id:'research',...body};return {id:'idn_a',metadata:body?.metadata};}};
 await assert.rejects(saveLoop(api,ws,base),/部分云端计划/);
 assert.equal(writes[0].body.metadata.wt_loop_save,'pending');
 assert.ok(!writes.some(w=>w.body?.metadata?.wt_loop_save==='complete'));
 assert.ok(!writes.some(w=>w.path==='/schedules'));
});
void test('morning research and final summary deliver while review stays independent',async()=>{
 const writes=[];let metadata={};const ws={identity:{id:'idn_a',metadata},resources:{schedule:'research',reviewSchedule:'review',deliverySchedule:'delivery',template:'template',environment:'env'},preferences:base};
 const api={request:async(method,path,body)=>{if(method==='GET')return {id:path.split('/').at(-1),status:'active'};writes.push({path,body});if(path==='/identities/idn_a'){metadata={...metadata,...body.metadata};return {id:'idn_a',metadata};}return {id:path.split('/').at(-1),...body};}};
 const updated=await saveLoop(api,ws,base,{channel:'channel_a',target:{type:'user',external_id:'native-user'}});
 assert.equal(writes.find(w=>w.path==='/schedules/research').body.sinks[0].channel_id,'channel_a');
 assert.equal(writes.find(w=>w.path==='/schedules/review').body.sinks,undefined);
 assert.equal(writes.find(w=>w.path==='/schedules/delivery').body.sinks[0].channel_id,'channel_a');
 assert.equal(updated.identity.metadata.wt_loop_save,'complete');assert.equal(JSON.parse(updated.identity.metadata.wt_target).external_id,'native-user');
});
