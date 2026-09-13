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
  url.searchParams.delete('__qca_region');
  url.searchParams.delete('__qca_route');
  req.url = `/api/qca/${region}/${route}${url.search ? url.search : ''}`;
  return handler(req, res);
}
