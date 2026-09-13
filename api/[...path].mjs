import { createHandler } from '../server/proxy.mjs';

export default createHandler({
  voiceEnabled: true,
  staticRoot: '/tmp/xiaowang-no-static',
});
