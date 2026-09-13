'use client';
import { useEffect, useState } from 'react';
import { Check, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { QcaClient, type Run } from '@/lib/qca';
import { type Workspace } from '@/lib/workflow';
import ReactMarkdown from 'react-markdown';
const labels: Record<string, string> = {
  pending: '等待执行',
  running: '执行中',
  completed: '执行结束',
  failed: '执行失败',
  skipped: '已跳过',
};
const deliveryLabels: Record<string, string> = {
  pending: '投递中',
  succeeded: '微信已送达',
  failed: '投递失败',
  skipped: '未投递',
};
export function WorkHistory({
  api,
  ws,
  revision,
}: {
  api: QcaClient;
  ws: Workspace;
  revision: number;
}) {
  const [records, setRecords] = useState<(Run & { phase: string })[]>([]);
  const [filter, setFilter] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const groups = await Promise.all(
          [
            { id: ws.resources.schedule, phase: '研究' },
            { id: ws.resources.reviewSchedule, phase: '复盘' },
            { id: ws.resources.deliverySchedule, phase: '汇报' },
            ...previousSchedules(ws),
            ...Object.entries(ws.identity.metadata)
              .filter(([key]) => /^wt_replay_\d{4}-\d{2}-\d{2}$/.test(key))
              .map(([key, id]) => ({ id, phase: `历史回放 · ${key.slice(10)}` })),
          ]
            .filter((s) => s.id)
            .map(async (s) => {
              const response = await api.request<{ data: Run[] }>(
                'GET',
                '/schedule_runs',
                undefined,
                { identity_id: ws.identity.id, schedule_id: s.id, limit: 20 },
              );
              return response.data.map((r) => ({ ...r, phase: s.phase }));
            }),
        );
        if (canceled) return;
        const rows = groups
          .flat()
          .sort((a, b) =>
            (b.triggered_at || '').localeCompare(a.triggered_at || ''),
          );
        setRecords(rows);
        setError('');
        if (
          rows.some(
            (r) =>
              ['running', 'pending'].includes(r.status) ||
              r.push_status === 'pending',
          )
        )
          timer = setTimeout(() => void load(), 10000);
      } catch (e) {
        if (!canceled)
          setError(e instanceof Error ? e.message : '工作记录暂时不可用');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    void load();
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [api, ws, revision]);
  const visible = records.filter(
    (r) => filter === '全部' || r.phase === filter || (filter === '历史回放' && r.phase.startsWith('历史回放')),
  );
  return (
    <section className="work-history">
      <p className="eyebrow">工作有迹可循</p>
      <h1>每一轮发生了什么。</h1>
      <p className="settings-lead">
        研究、独立复盘与汇报分别记录。执行结束不代表方法已经通过验证，具体结论保留在每轮结果里。
      </p>
      <fieldset className="memory-role-tabs" aria-label="筛选任务类型">
        {['全部', '研究', '复盘', '汇报', '历史回放'].map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            aria-pressed={filter === p}
          >
            {p}
          </button>
        ))}
      </fieldset>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {loading ? (
        <p>正在读取云端记录…</p>
      ) : !visible.length ? (
        <div className="empty-state">
          <Clock />
          <h3>这里会留下它的工作</h3>
          <p>运行研究或启用计划后，真实结果会出现在这里。</p>
        </div>
      ) : (
        visible.map((run, index) => (
          <div key={run.id}>
          {(index === 0 || day(run.triggered_at) !== day(visible[index - 1].triggered_at)) && (
            <h2>{day(run.triggered_at)} · 执行记录</h2>
          )}
          <details className="work-record" key={run.id}>
            <summary>
              <span className={'work-status ' + run.status}>
                {run.status === 'completed' ? (
                  <Check size={18} />
                ) : run.status === 'failed' ? (
                  <AlertCircle size={18} />
                ) : (
                  <Clock size={18} />
                )}
              </span>
              <span>
                <strong>
                  {run.phase} · {labels[run.status] || run.status}
                </strong>
                <small>
                  {run.triggered_at
                    ? new Date(run.triggered_at).toLocaleString('zh-CN')
                    : '时间待更新'}
                </small>
              </span>
              <span className="delivery-state">
                {deliveryLabels[run.push_status || 'skipped'] ||
                  run.push_status}
              </span>
              <ChevronDown size={17} />
            </summary>
            <div className="report-prose">
              <ReactMarkdown
                skipHtml
                components={{
                  img: () => null,
                  a: ({ href, children }) =>
                    href?.startsWith('https://') ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ) : (
                      <span>{children}</span>
                    ),
                }}
              >
                {run.result_payload || run.error_message || '结果尚未返回。'}
              </ReactMarkdown>
            </div>
          </details>
          </div>
        ))
      )}
    </section>
  );
}

function day(value?: string) {
  return value ? new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '日期待确认';
}

function previousSchedules(ws: Workspace): { id: string; phase: string }[] {
  try {
    const rows = JSON.parse(ws.identity.metadata.wt_previous_loop || '[]');
    const phases: Record<string, string> = { schedule: '研究', reviewSchedule: '复盘', deliverySchedule: '汇报' };
    return Array.isArray(rows) ? rows.filter((r) => typeof r.id === 'string' && phases[r.phase]).map((r) => ({ id: r.id, phase: phases[r.phase] })) : [];
  } catch { return []; }
}
