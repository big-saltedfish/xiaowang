export default function health(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ voiceRealtimeProxy: { enabled: true } }));
}
