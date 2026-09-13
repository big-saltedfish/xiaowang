import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createVoiceProxy } from '../server/voiceProxy.mjs';

test('Vercel voice accepts same-site TLS origin without opening cross-site access', async () => {
  const server = createServer();
  const proxy = createVoiceProxy({allowLocal:false,allowSameOrigin:true,baseUrls:{},authTimeoutMs:1000});
  assert.equal(proxy.enabled,true);
  proxy.attach(server);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const host = `127.0.0.1:${server.address().port}`;
  const good = new WebSocket(`ws://${host}/api/voice/socket`, {origin:`https://${host}`});
  try {
    await once(good,'open');
    good.close(); await once(good,'close');
    const bad = new WebSocket(`ws://${host}/api/voice/socket`, {origin:'https://unrelated.example'});
    const status = await new Promise(resolve => {
      bad.on('unexpected-response', (_req,res) => {const status=res.statusCode;res.resume();bad.terminate();resolve(status);});
      bad.on('error',()=>{});
    });
    assert.equal(status,403);
  } finally { good.terminate(); server.close(); }
});
