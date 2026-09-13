import { createHandler } from '../server/proxy.mjs';

const handler = createHandler({
  voiceEnabled: true,
  staticRoot: '/tmp/xiaowang-no-static',
});

export default function forward(req, res) {
  const url = new URL(req.url, 'https://localhost');
  const region = url.searchParams.get('__qca_region');
  const route = url.searchParams.get('__qca_route');
  if (!['cn', 'global'].includes(region) || !route) {
    res.writeHead(404); res.end(); return;
  }
  // Vercel adds route captures and re-encodes query values during rewrites.
  // QCA accepts only declared query keys and requires literal Drive separators.
  for (const key of ['__qca_region', '__qca_route', 'region', 'route']) {
    url.searchParams.delete(key);
  }
  const query = url.searchParams.toString().replace(/%2F/gi, '/');
  req.url = `/api/qca/${region}/${route}${query ? '?' + query : ''}`;
  return handler(req, res);
}
