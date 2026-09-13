import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { latestReport } from '../lib/latest-report.ts';
const hash = (s) => createHash('sha256').update(s).digest('hex');
function fixture(changed = false) {
  const report = '# 真实归档报告';
  const manifest = JSON.stringify({completed:true,date:'2026-09-12',files:{'report.md':{path:'reports/r.md',sha256:hash(report)}}});
  return {list:async()=>[{id:'m',path:'research/latest-publication.json'}],request:async()=>({content:JSON.stringify({manifest_path:'reports/manifest.json',manifest_sha256:hash(manifest)})}),readDriveFile:async(_,p)=>p.endsWith('manifest.json')?manifest:changed?'changed':report};
}
test('latest report resolves from published pointer and verifies both hashes', async()=>{
  assert.deepEqual(await latestReport(fixture(),'i','s'),{date:'2026-09-12',text:'# 真实归档报告'});
});
test('changed report content is rejected instead of showing an unverified result', async()=>{
  await assert.rejects(latestReport(fixture(true),'i','s'),/校验不一致/);
});
test('missing publication has an actionable empty state',async()=>{
  await assert.rejects(latestReport({list:async()=>[]},'i','s'),/还没有已归档/);
});
