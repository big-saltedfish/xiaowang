'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { QcaClient } from '@/lib/qca';
import { latestReport } from '@/lib/latest-report';

export function LatestResearch({ api, identity, store, onListen }: { api: QcaClient; identity: string; store: string; onListen: () => void }) {
  const [value, setValue] = useState<{date: string; text: string} | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let canceled = false;
    void latestReport(api, identity, store).then((v) => { if (!canceled) setValue(v); }).catch((e) => { if (!canceled) setError(e instanceof Error ? e.message : '暂时无法读取报告'); });
    return () => { canceled = true; };
  }, [api, identity, store, attempt]);
  return <section className="latest-research">
    <p className="eyebrow">最近研究成果</p><h2>{value ? `${value.date} · 研究报告` : '读取最近一份报告'}</h2>
    <p className="settings-lead">从云端档案读取，保留报告原始日期。</p>
    {error ? <div role="alert"><p>{error}</p><button className="text-action" onClick={() => { setValue(null); setError(''); setAttempt((v) => v + 1); }}>重新读取</button></div> : !value ? <output>正在核对报告与归档记录…</output> : <><button className="call-button" onClick={onListen}>听一分钟总结</button><div className="report-prose"><ReactMarkdown skipHtml components={{ img: () => null }}>{value.text}</ReactMarkdown></div></>}
  </section>;
}
