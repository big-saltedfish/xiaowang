import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHandler } from './proxy.mjs';
import { createVoiceProxy } from './voiceProxy.mjs';
const host = process.env.WATCHTOWER_HOST || '127.0.0.1';
const port = Number(process.env.WATCHTOWER_PORT || 5178);
const voiceProxy = createVoiceProxy({
  baseUrls: {
    'cn-prod': 'https://api.qoder.com.cn/api/v1/forward',
    'global-prod': 'https://api.qoder.com/api/v1/forward',
  },
  allowLocal: false,
  allowedOrigins: [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...(port === 5179
      ? ['http://localhost:5178', 'http://127.0.0.1:5178']
      : []),
    ...(process.env.WATCHTOWER_ORIGINS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  ],
  maxConnectionMs: 60 * 60 * 1000,
});
const server = createServer(
  createHandler({
    voiceEnabled: voiceProxy.enabled,
    staticRoot: fileURLToPath(new URL('../dist/client', import.meta.url)),
  }),
);
voiceProxy.attach(server);
server.requestTimeout = 60000;
server.headersTimeout = 15000;
server.listen(port, host, () =>
  console.log(`Watchtower ready at http://${host}:${port}`),
);
