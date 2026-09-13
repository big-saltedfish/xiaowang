import { createServer } from 'node:http';
import { createVoiceProxy } from '../../server/voiceProxy.mjs';

const server = createServer((_req, res) => {
  res.writeHead(426, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
  res.end('WebSocket upgrade required');
});
const proxy = createVoiceProxy({
  baseUrls: {
    'cn-prod': 'https://api.qoder.com.cn/api/v1/forward',
    'global-prod': 'https://api.qoder.com/api/v1/forward',
  },
  allowLocal: false,
  allowSameOrigin: true,
  maxConnectionMs: 240000,
});
proxy.attach(server);
export default server;
