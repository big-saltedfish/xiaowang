import type { QcaClient, Memory } from './qca.ts';

export async function latestReport(api: QcaClient, identity: string, store: string) {
  const rows = await api.list<Memory>(`/memory_stores/${store}/memories`);
  const entry = rows.find((r) => r.path === 'research/latest-publication.json');
  if (!entry) throw new Error('还没有已归档的研究报告。');
  const memory = await api.request<Memory>('GET', `/memory_stores/${store}/memories/${entry.id}`);
  const pointer = JSON.parse(memory.content || '{}');
  if (typeof pointer.manifest_path !== 'string') throw new Error('最新报告记录不完整。');
  const manifestText = await api.readDriveFile(identity, pointer.manifest_path);
  if (await digest(manifestText) !== pointer.manifest_sha256) throw new Error('报告目录校验不一致，请刷新后重试。');
  const manifest = JSON.parse(manifestText);
  const file = manifest.files?.['report.md'];
  if (manifest.completed !== true || typeof file?.path !== 'string') throw new Error('报告尚未完成归档。');
  const text = await api.readDriveFile(identity, file.path);
  if (await digest(text) !== file.sha256) throw new Error('报告校验不一致，暂不展示。');
  return { date: String(manifest.date), text };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
