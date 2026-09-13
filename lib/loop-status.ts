import type { Schedule } from './qca.ts';

export function isRecurring(schedule?: Schedule | null): boolean {
  return schedule?.status === 'active' && schedule.trigger_policy.type === 'cron';
}

export function methodStatus(policy: Record<string, unknown> | null): string {
  if (!policy) return '尚无方法记录，等待复盘';
  const labels: Record<string, string> = {
    baseline: '沿用基线方法 · 等待对照评测',
    trial: '改法已通过检查，待下轮验证',
    active: '已采用验证后的方法',
    adopted: '新方法已被后续研究采用',
    rollback: '已回退到先前方法',
    reverted: '已回退到先前方法',
  };
  const label = labels[String(policy.status)] || '方法状态待核实';
  return label;
}

export function methodLesson(policy: Record<string, unknown> | null): string {
  const rules = policy?.policy as Record<string, unknown> | undefined;
  if (rules?.require_dates === true) return '没有明确日期的资料，先核实再采用。';
  if (rules?.deduplicate === true) return '同一来源不重复计入研究依据。';
  return '保留本轮问题与证据，供下一轮复核。';
}

export function memoryTitle(path: string): string {
  if (path === 'governance/active-policy.json') return '当前研究方法';
  if (path.includes('/processed/')) return '本轮复盘依据';
  if (path.endsWith('latest-review.json')) return '最近一次复盘';
  if (path.endsWith('latest-publication.json')) return '最近一次研究';
  if (path === 'MEMORY.md') return '记忆目录';
  if (path.endsWith('lessons.md')) return '研究经验';
  if (path.endsWith('open-questions.md')) return '待核实问题';
  return path.split('/').pop() || path;
}

export const MEMORY_PROTOCOL = `
【记忆与每日批次协议】
Memory 与 Drive 是不同的存储。research/latest-publication.json、independent-review/latest-review.json、governance/active-policy.json、feedback/ 都是记忆路径：必须用 Read 读取 /data/.qoder/awareness/ 下对应路径，不得用 list_drive_entries 查找它们，不得猜测 /data/.agent/awareness/。
记忆写入必须使用 Write 到 /data/.qoder/awareness/ 下本角色可写前缀，确认工具返回 [memory] created/updated 才算持久化；随后 Read 回读。维护本角色 MEMORY.md 索引，仅指向本角色文件，不覆盖其他角色内容。只读挂载不可写。
研究的报告、原始来源、校验文件和 manifest 保存在 Drive；从记忆取得 manifest 路径后才调用 Drive 工具读取。语音问答先读上述记忆，再按 manifest 挂载并阅读 report.md，不把摘要当报告全文。引用报告日期，历史报告不得称为今日行情。
每轮研究用实际 manifest hash 和日期作为唯一批次，不用日期伪造方法版本。复盘结束后，将本次 review.json/review.md 保存到 reviews/YYYY/MM/DD/唯一批次/，其中保留 report_manifest_hash、status、method_status、原因、下一步及 evidence_paths；等待和失败也保留独立记录，不能只覆盖 latest。研究/复盘/汇报以同一个 manifest hash 关联。
每日可以有新研究批次，但方法无改进时明确 no_change；只有固定评测通过并被后续研究采用才叫方法升级，不承诺每天变好。
`;
