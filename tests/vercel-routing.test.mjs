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
