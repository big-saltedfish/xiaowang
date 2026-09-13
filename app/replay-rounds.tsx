'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { QcaClient } from '@/lib/qca';
import type { Workspace } from '@/lib/workflow';
import './research-assets.css';

interface Replay { as_of_date: string; generated_at: string; completed: boolean; previous_replay_date: string | null; method_status: string }
export function ReplayRounds({ api, ws }: { api: QcaClient; ws: Workspace }) {
  const [expanded, setExpanded] = useState(false);
  const [rounds, setRounds] = useState<Record<string, Replay>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [report, setReport] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const dates = Object.keys(ws.identity.metadata).filter((k) => /^wt_replay_\d{4}-\d{2}-\d{2}$/.test(k)).map((k) => k.slice(10)).sort();
  const dateKey = dates.join(',');
  useEffect(() => {
    if (!expanded) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      const values: Record<string, Replay> = {};
      const failures: Record<string, string> = {};
      await Promise.all(dateKey.split(',').filter(Boolean).map(async (date) => {
        try {
          const v = JSON.parse(await api.readDriveFile(ws.identity.id, `replays/${date}/loop.json`));
          if (v.mode !== 'historical_replay' || v.as_of_date !== date) throw new Error('回放标识不匹配');
          values[date] = v;
        } catch { failures[date] = '尚未取得完整回放档案'; }
      }));
      if (canceled) return;
      setRounds(values); setErrors(failures);
      if (Object.keys(failures).length) timer = setTimeout(() => void load(), 15000);
    }
    void load();
    return () => { canceled = true; clearTimeout(timer); };
  }, [api, ws.identity.id, dateKey, expanded]);
  if (!dates.length) return null;
  async function read(date: string, type: 'report' | 'review') {
    setLoading(true); setTitle(`${date} · 历史回放 · ${type === 'report' ? '盘前研究' : '收盘复盘'}`); setReport('');
    try { setReport(await api.readDriveFile(ws.identity.id, `replays/${date}/${type}.md`)); }
    catch { setReport('暂时无法读取这份档案，请稍后重试。'); }
    finally { setLoading(false); }
  }
  return <details className="replay-rounds replay-collapse" onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>查看历史回放 <span>{dates.length} 个工作日 · 演示时展开</span></summary>
    <h2>昨天的问题，成为今天的起点。</h2>
    <p>按历史截止时间补跑，实际执行时间保留；不代表当时自动运行。</p>
    <div className="replay-grid">{dates.map((date) => <article key={date}>
      <h3>{date.slice(5).replace('-', ' / ')}</h3>
      <strong>{rounds[date]?.completed ? '研究 → 复盘 → 记忆已归档' : errors[date] || '读取云端档案…'}</strong>
      <p>{rounds[date]?.previous_replay_date ? `承接 ${rounds[date].previous_replay_date} 的回放记忆` : '建立本轮观察与待核实问题'}</p>
      {rounds[date] && <small>{rounds[date].method_status === 'candidate' ? '方法候选，尚未验证' : '沿用现有方法'} · {new Date(rounds[date].generated_at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })} 补跑</small>}
      <div><button disabled={loading || !rounds[date]?.completed} onClick={() => void read(date, 'report')}>盘前报告</button><button disabled={loading || !rounds[date]?.completed} onClick={() => void read(date, 'review')}>收盘复盘</button></div>
    </article>)}</div>
    {title && <div className="report-prose"><h3>{title}</h3><button onClick={() => setTitle('')}>收起</button>{loading ? <p>读取 Drive…</p> : <ReactMarkdown skipHtml components={{ img: () => null }}>{report}</ReactMarkdown>}</div>}
  </details>;
}
