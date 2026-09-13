import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import forward from '../api/forward.mjs';

test('rewritten nested API routes reach authentication rather than static 404', async () => {
  const server = createServer(forward);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base+'/api/forward?__qca_region=global&__qca_route=realtime/conversations');
    assert.equal(response.status,401);
    assert.equal((await response.json()).error.code,'authentication_required');
    assert.equal((await fetch(base+'/api/forward?__qca_region=unknown&__qca_route=models')).status,404);
  } finally { server.close(); }
});

test('nested Drive path reaches QCA without encoding its separators', async () => {
  const originalFetch = globalThis.fetch;
  let upstream;
  globalThis.fetch = async (url) => {
    upstream = String(url);
    return new Response(JSON.stringify({entries: []}), {status: 200});
  };
  // The proxy captures fetch on import; load a fresh handler for this test.
  try {
    const {createHandler} = await import('../server/proxy.mjs');
    const handler = createHandler({fetcher: globalThis.fetch});
    let output;
    await handler({url:'/api/qca/global/drives/entries?identity_id=idn_test&path=reports/2026&limit=100',method:'GET',headers:{authorization:'Bearer test'}}, {setHeader(){},writeHead(){},end(value){output=value;}});
    assert.ok(output);
    assert.match(upstream,/path=reports\/2026/);
    const req = {url:'/api/forward?__qca_region=global&__qca_route=drives/entries&identity_id=idn_test&path=reports%2F2026&limit=100&region=global&route=drives%2Fentries',method:'GET',headers:{}};
    await forward(req,{setHeader(){},writeHead(){},end(){}});
    assert.equal(req.url,'/api/qca/global/drives/entries?identity_id=idn_test&path=reports/2026&limit=100');
  } finally {globalThis.fetch=originalFetch;}
});
