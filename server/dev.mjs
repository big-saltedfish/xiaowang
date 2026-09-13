import { spawn } from 'node:child_process';
const proxy = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, WATCHTOWER_PORT: '5179' },
});
const web = spawn(
  'npm',
  ['exec', '--', 'vinext', 'dev', '--host', '127.0.0.1', '--port', '5178'],
  { stdio: 'inherit' },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  proxy.kill();
  web.kill();
  process.exitCode = code;
}
for (const child of [proxy, web]) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
