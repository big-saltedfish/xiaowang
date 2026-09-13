'use client';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import remarkGfm from 'remark-gfm';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  Cloud,
  FileText,
  Folder,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { memoryTitle } from '@/lib/loop-status';
import {
  QcaClient,
  QcaError,
  parseTarget,
  eventText,
  type Region,
  type Run,
  type Schedule,
  type DriveEntry,
  type Memory,
  type MemoryVersion,
  type Channel,
  type QrSession,
  type Event,
} from '@/lib/qca';
import {
  bootstrap,
  restoreWorkspace,
  savePreferences,
  saveDelivery,
  configureIfind,
  runNeedsRefresh,
  ensureWechat,
  createQr,
  runNow,
  getSchedule,
  IFIND_SERVICES,
  type Workspace,
  type Preferences,
} from '@/lib/workflow';
const views = [
  { id: 'overview', label: '云端值守', icon: Activity },
  { id: 'reports', label: '报告档案', icon: FolderOpen },
  { id: 'memory', label: '记忆与进化', icon: Brain },
  { id: 'channel', label: '微信通知', icon: MessageCircle },
  { id: 'settings', label: '研究计划', icon: Settings2 },
];
const statusLabels: Record<string, string> = {
  pending: '排队中',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
  active: '已启用',
  paused: '已暂停',
  archived: '已归档',
  succeeded: '投递成功',
  waiting: '等待扫码',
  scanned: '已扫码，待确认',
  confirmed: '授权已确认',
  expired: '授权已过期',
  denied: '授权被拒绝',
  error: '授权失败',
  bound: '已绑定',
  unbound: '未绑定',
};
function status(s?: string) {
  return s ? (statusLabels[s] ?? s) : '未配置';
}
function when(s?: string) {
  if (!s) return '暂无';
  const d = new Date(s);
  return Number.isNaN(d.valueOf())
    ? '时间未知'
    : d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : '操作失败，请刷新后重试。';
}
function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          a: ({ href, children }) =>
            href?.startsWith('https://') ? (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Cloud size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="view-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export default function LiveApp() {
  const [api, setApi] = useState<QcaClient | null>(null),
    [ws, setWs] = useState<Workspace | null>(null),
    [view, setView] = useState('overview');
  const [region, setRegion] = useState<Region>('cn'),
    [pat, setPat] = useState(''),
    [ifind, setIfind] = useState('');
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const main = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) main.current?.focus({ preventScroll: true });
    mounted.current = true;
  }, [view, api]);
  async function action(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(errorText(e) + (e instanceof QcaError ? `（${e.code}）` : ''));
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress('');
    }
  }
  const go = (v: string) => {
    setView(v);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  async function connect() {
    await action(async () => {
      setProgress('通过转发服务连接 QCA');
      const next = new QcaClient(region, pat);
      await next.request('GET', '/models');
      let workspace = await restoreWorkspace(next);
      if (!workspace?.resources.schedule || !workspace.resources.store) {
        setProgress('加载研究工作流');
        const file = await fetch('/watchtower-research.zip');
        if (!file.ok) throw new Error('研究技能包缺失，请重新构建应用。');
        workspace = await bootstrap(
          next,
          ifind,
          await file.blob(),
          setProgress,
        );
      } else if (ifind.trim()) {
        await configureIfind(
          next,
          workspace.resources.vault!,
          workspace.identity.id,
          ifind,
          setProgress,
        );
      }
      setApi(next);
      setWs(workspace);
      setPat('');
      setIfind('');
      setNotice('已从 QCA 恢复研究站。请绑定微信并启用计划。');
    });
  }
  if (!api || !ws)
    return (
      <main className="onboarding">
        <section className="onboarding-brand">
          <div className="brand">
            <div className="brand-icon">
              <CircleDot size={24} />
            </div>
            <div>
              <b>守望</b>
              <span>WATCHTOWER</span>
            </div>
          </div>
          <p className="eyebrow">YOUR RESEARCH, ON AUTOPILOT</p>
          <h1>
            你去生活，
            <br />
            它在云端做功课。
          </h1>
          <p>
            一次配置，持续研究。
            <br />
            报告留下来，经验带到下一轮。
          </p>
          <div className="onboarding-benefits">
            <span>
              <Cloud />
              QCA 负责定时执行
            </span>
            <span>
              <FolderOpen />
              Drive 保存每日档案
            </span>
            <span>
              <Brain />
              记忆记录偏好与方法变化
            </span>
            <span>
              <MessageCircle />
              微信接收研究摘要
            </span>
          </div>
          <small>研究在 QCA 云端执行，关闭网页不影响已启用的计划。</small>
        </section>
        <section className="onboarding-form">
          <p className="eyebrow">CONNECT YOUR RESEARCH STATION</p>
          <h2>连接你的研究站</h2>
          <p className="secondary">
            首次自动创建云环境、凭证库、研究模板和手动验收计划。之后可从 QCA
            恢复。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <fieldset disabled={busy}>
              <label htmlFor="region">QCA 服务区域</label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value as Region)}
              >
                <option value="cn">国内 · api.qoder.com.cn</option>
                <option value="global">海外 · api.qoder.com</option>
              </select>
              <label htmlFor="qca-key">QCA API Key / PAT</label>
              <input
                id="qca-key"
                type="password"
                autoComplete="off"
                required
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="输入此区域的个人访问令牌"
              />
              <label htmlFor="ifind-key">
                同花顺 MCP Key <span>首次配置需要</span>
              </label>
              <input
                id="ifind-key"
                type="password"
                autoComplete="off"
                value={ifind}
                onChange={(e) => setIfind(e.target.value)}
                placeholder="留空沿用云端凭证，填写则更新"
              />
              <p className="form-note">
                QCA Key 仅保留在当前页面内存；同花顺 Key 写入 QCA
                Vault。关闭后重新输入 QCA Key 即可恢复，不重复创建研究站。
              </p>
              <Button
                type="submit"
                className="solid-button connect-button"
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <KeyRound size={17} />
                )}{' '}
                {busy ? progress || '连接中' : '连接并初始化'}
                <ArrowRight size={17} />
              </Button>
            </fieldset>
          </form>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <details className="connection-details">
            <summary>连接失败时如何处理</summary>
            <p>
              网页通过本站转发服务访问 QCA。请确认转发服务已启动、Key
              与所选区域一致。转发服务不保存密钥或业务数据。
            </p>
          </details>
        </section>
      </main>
    );
  const props = { api, ws, revision };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        跳到工作区
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <CircleDot size={23} />
          </div>
          <div>
            <b>守望</b>
            <span>WATCHTOWER</span>
          </div>
        </div>
        <div className="space-switch">
          <span className="avatar">我</span>
          <div>
            <strong>我的研究站</strong>
            <small>{api.region === 'cn' ? '国内' : '海外'} · QCA 云端</small>
          </div>
        </div>
        <p className="nav-label">工作空间</p>
        <nav aria-label="工作空间导航">
          {views.map((v) => (
            <button
              key={v.id}
              className={`nav-item ${view === v.id ? 'selected' : ''}`}
              disabled={busy}
              aria-label={v.label}
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => go(v.id)}
            >
              <v.icon size={19} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Cloud size={22} />
            <strong>关掉网页，计划继续。</strong>
            <p>
              只在需要时回来，
              <br />
              看看它留下的成果。
            </p>
          </div>
          <button
            className="nav-item"
            disabled={busy}
            onClick={() => {
              setApi(null);
              setWs(null);
              setError('');
              setNotice('');
            }}
          >
            <LogOut size={17} />
            <span>断开本页连接</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            我的研究站
            <ChevronRight size={14} />
            <strong>{views.find((v) => v.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="tag">QCA 已连接</span>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setRevision((r) => r + 1)}
              aria-label="刷新云端数据"
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </header>
        <main
          ref={main}
          tabIndex={-1}
          aria-label={views.find((v) => v.id === view)?.label}
          id="workspace"
          className="workspace"
        >
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
          {notice && <output className="notice-banner">{notice}</output>}
          {busy && (
            <output className="working-banner">
              <LoaderCircle size={16} className="spin" />
              {progress || '正在更新 QCA，请稍候…'}
            </output>
          )}
          {view === 'overview' && (
            <Overview
              {...props}
              go={go}
              busy={busy}
              action={action}
              refresh={() => setRevision((r) => r + 1)}
            />
          )}
          {view === 'reports' && <Reports {...props} />}
          {view === 'memory' && (
            <Memories
              {...props}
              busy={busy}
              action={action}
              refresh={() => setRevision((r) => r + 1)}
            />
          )}
          {view === 'channel' && (
            <Wechat
              {...props}
              busy={busy}
              action={action}
              onWorkspace={setWs}
              notify={setNotice}
            />
          )}
          {view === 'settings' && (
            <Plan
              {...props}
              busy={busy}
              action={action}
              onWorkspace={setWs}
              notify={setNotice}
            />
          )}
          <footer className="page-footer">
            <span>WATCHTOWER / 守望</span>
            <span>云端研究 · 不执行交易 · 数据与判断保留来源</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
type ViewProps = { api: QcaClient; ws: Workspace; revision: number };
type Actions = {
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
};
export function Overview({
  api,
  ws,
  revision,
  go,
  busy,
  action,
  refresh,
}: ViewProps & Actions & { go: (v: string) => void; refresh: () => void }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null),
    [runs, setRuns] = useState<Run[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const s = await getSchedule(api, ws.resources.schedule!);
        const list = await api.list<Run>('/schedule_runs', {
          schedule_id: s.id,
          identity_id: ws.identity.id,
        });
        if (canceled) return;
        setSchedule(s);
        setRuns(list);
        setError('');
        const first = list[0];
        if (first?.session_id) {
          const history = await api.list<Event>(
            `/sessions/${first.session_id}/events`,
          );
          if (!canceled) setEvents(history);
        }
        if (!canceled && list.some(runNeedsRefresh))
          timer = setTimeout(() => void load(), 6000);
      } catch (e) {
        if (!canceled) setError(errorText(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [api, ws, revision]);
  const latest = runs[0],
    next = schedule?.trigger_policy.upcoming_runs_at?.[0];
  return (
    <>
      <section className="intro">
        <div>
          <p className="eyebrow">YOUR RESEARCH, ON AUTOPILOT</p>
          <h1>
            你去生活，
            <br />
            <span>它在云端做功课。</span>
          </h1>
          <p className="intro-copy">
            {ws.preferences.watchlist}
            <br />
            按计划研究，积累报告和经验。
          </p>
        </div>
        <div className="next-run">
          <div className="next-label">
            <span className="status-dot" />
            下次计划执行
          </div>
          <div className="live-next">
            {loading ? '读取中' : next ? when(next) : '尚未启用'}
          </div>
          <p>
            {schedule ? status(schedule.status) : '正在连接'} ·{' '}
            {schedule?.trigger_policy.type === 'manual'
              ? '手动验收模式'
              : '云端计划'}
          </p>
          <div className="next-bottom">
            <Cloud size={17} />
            <span>网页关闭不影响已启用的计划</span>
          </div>
        </div>
      </section>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <section className="loop-panel">
        <div className="loop-header">
          <span className="live-pill">每轮研究工作流</span>
          <span className="secondary">
            这是执行约定，实际进度以下方云端记录为准
          </span>
        </div>
        <div className="loop-stages">
          {[
            { label: '读取记忆', icon: Brain },
            { label: '查询资料', icon: BookOpen },
            { label: '核验来源', icon: ShieldCheck },
            { label: '保存报告', icon: FolderOpen },
            { label: '复盘方法', icon: Sparkles },
            { label: '微信通知', icon: MessageCircle },
          ].map((s, i) => (
            <div className="loop-stage" key={s.label}>
              <span className="stage-number">0{i + 1}</span>
              <div className="stage-icon">
                <s.icon size={22} />
              </div>
              <strong>{s.label}</strong>
              {i < 5 && <ArrowRight className="stage-arrow" size={15} />}
            </div>
          ))}
        </div>
        <div className="loop-return">
          记忆和档案由 QCA 保存。每轮从新 Session 开始，接着已有工作推进。
        </div>
      </section>
      <div className="live-actions">
        <Button
          className="solid-button"
          disabled={
            busy ||
            loading ||
            schedule?.status !== 'active' ||
            runs.some((r) => ['pending', 'running'].includes(r.status))
          }
          onClick={() =>
            void action(async () => {
              await runNow(api, ws.resources.schedule!, crypto.randomUUID());
              refresh();
            })
          }
        >
          <Play size={16} />
          立即研究一轮
        </Button>
        <Button
          variant="outline"
          disabled={busy || loading || !schedule}
          onClick={() =>
            void action(async () => {
              await api.request(
                'POST',
                `/schedules/${schedule!.id}/${schedule!.status === 'paused' ? 'unpause' : 'pause'}`,
              );
              refresh();
            })
          }
        >
          {schedule?.status === 'paused' ? (
            <Play size={16} />
          ) : (
            <Pause size={16} />
          )}{' '}
          {schedule?.status === 'paused' ? '恢复计划' : '暂停计划'}
        </Button>
        <Button variant="ghost" onClick={() => go('settings')}>
          调整研究计划
          <ArrowRight size={16} />
        </Button>
      </div>
      <div className="overview-columns">
        <section className="panel">
          <h2>最近一次交付</h2>
          {loading ? (
            <p className="secondary">读取云端记录…</p>
          ) : latest ? (
            <>
              <div className="run-badges">
                <span className="tag">执行：{status(latest.status)}</span>
                <span className="tag muted">
                  通知：{status(latest.push_status)}
                </span>
              </div>
              <p className="secondary">{when(latest.triggered_at)}</p>
              {latest.result_payload ? (
                <Markdown text={latest.result_payload} />
              ) : (
                <p className="reader-lead">
                  {['pending', 'running'].includes(latest.status)
                    ? 'Agent 正在云端工作，可以离开本页。'
                    : '此记录未提供摘要。'}
                </p>
              )}
              {latest.error_message && (
                <p className="error-banner">
                  任务未完成，请查看 QCA 中的运行详情。
                </p>
              )}
              <Button variant="link" onClick={() => go('reports')}>
                浏览 Drive 中的报告
                <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <Empty title="还没有研究报告">
              先绑定微信，再配置计划；也可以立即执行一轮验证资料查询和归档。
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>云端执行历史</h2>
          {runs.length ? (
            runs.slice(0, 8).map((r) => (
              <div className="history-row" key={r.id}>
                <span>
                  <strong>{when(r.triggered_at)}</strong>
                  <small>
                    {r.duration_ms
                      ? `${Math.round(r.duration_ms / 1000)} 秒`
                      : '尚无耗时'}{' '}
                    · 通知{status(r.push_status)}
                  </small>
                </span>
                <span className="tag">{status(r.status)}</span>
              </div>
            ))
          ) : (
            <Empty title="每一次执行，都会留下记录">
              计划触发与执行状态将从 QCA 读取，页面不生成模拟记录。
            </Empty>
          )}
        </section>
      </div>
      {events.length > 0 && (
        <section className="panel">
          <h2>最近一轮执行事件</h2>
          <div className="event-log">
            {events.slice(-15).map((e) => (
              <div key={e.id}>
                <code>{e.type}</code>
                <span>{eventText(e).slice(0, 350) || when(e.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function Reports({ api, ws, revision }: ViewProps) {
  const [path, setPath] = useState('reports'),
    [entries, setEntries] = useState<DriveEntry[]>([]),
    [selected, setSelected] = useState<DriveEntry | null>(null),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const selection = useRef(0);
  useEffect(() => {
    let canceled = false;
    setLoading(true);
    void api
      .driveEntries(ws.identity.id, path)
      .then((r) => {
        if (!canceled) {
          setEntries(r);
          setError('');
        }
      })
      .catch((e) => {
        if (!canceled) setError(errorText(e));
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [api, ws.identity.id, path, revision, retry]);
  function navigate(next: string) {
    if (next === path) return;
    selection.current++;
    setLoading(true);
    setEntries([]);
    setSelected(null);
    setText('');
    setError('');
    setPath(next);
  }
  async function open(e: DriveEntry) {
    if (e.type === 'directory') {
      navigate(e.path);
      return;
    }
    const ticket = ++selection.current;
    setSelected(e);
    setText('');
    setError('');
    try {
      const result = await api.readDriveFile(ws.identity.id, e.path);
      if (ticket === selection.current) setText(result);
    } catch (err) {
      if (ticket === selection.current) setError(errorText(err));
    }
  }
  return (
    <>
      <Heading eyebrow="YOUR RESEARCH ARCHIVE" title="会话结束，成果留下。">
        直接浏览 QCA Drive。文件保存成功后，才会出现在这里。
      </Heading>
      <div className="archive-toolbar">
        <div>
          <Folder size={17} />
          <button onClick={() => navigate('')}>Drive</button>
          {path
            .split('/')
            .filter(Boolean)
            .map((p, i) => (
              <span key={i}>
                <ChevronRight size={13} />
                <button
                  onClick={() =>
                    navigate(
                      path
                        .split('/')
                        .slice(0, i + 1)
                        .join('/'),
                    )
                  }
                >
                  {p}
                </button>
              </span>
            ))}
        </div>
        <span className="secondary">{entries.length} 个目录项</span>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button className="text-action" onClick={() => setRetry((n) => n + 1)}>重新加载目录</button>
        </div>
      )}
      <div className="archive-layout">
        <aside className="archive-list">
          {loading ? (
            <p>正在读取目录…</p>
          ) : error && !entries.length ? (
            <p>目录暂时无法加载，请重试。</p>
          ) : entries.length ? (
            entries.map((e) => (
              <button
                key={e.path}
                className={`archive-item ${selected?.path === e.path ? 'active' : ''}`}
                onClick={() => void open(e)}
              >
                <div className="archive-item-top">
                  {e.type === 'directory' ? (
                    <Folder size={19} />
                  ) : (
                    <FileText size={19} />
                  )}
                  <span>
                    {e.type === 'directory'
                      ? '文件夹'
                      : e.size
                        ? `${(e.size / 1024).toFixed(1)} KB`
                        : '文件'}
                  </span>
                </div>
                <strong>{e.name}</strong>
                <small>
                  {e.last_modified ? when(e.last_modified) : '点击打开'}
                </small>
              </button>
            ))
          ) : (
            <Empty title="这里还没有档案">
              首次研究完成并保存至 Drive 后，即可按日期浏览。
            </Empty>
          )}
        </aside>
        <article className="report-reader">
          {selected ? (
            <>
              <p className="eyebrow">QCA DRIVE / {selected.name}</p>
              {text ? (
                selected.name.endsWith('.json') ? (
                  <pre className="json-preview">{text}</pre>
                ) : (
                  <Markdown text={text} />
                )
              ) : (
                <p>{error ? '文件尚未读取成功' : '正在读取正文…'}</p>
              )}
            </>
          ) : (
            <Empty title="把每一天的研究连起来">
              在左侧选择日期文件夹和报告。正文只在打开时下载，不自动加载全部历史。
            </Empty>
          )}
        </article>
      </div>
    </>
  );
}
export function Memories({
  api,
  ws,
  revision,
  busy,
  action,
  refresh,
  readOnly = false,
}: ViewProps & Actions & { refresh: () => void; readOnly?: boolean }) {
  const [list, setList] = useState<Memory[]>([]),
    [selected, setSelected] = useState<Memory | null>(null),
    [draft, setDraft] = useState(''),
    [versions, setVersions] = useState<MemoryVersion[]>([]),
    [older, setOlder] = useState<MemoryVersion | null>(null),
    [error, setError] = useState('');
  const selection = useRef(0);
  useEffect(() => {
    let canceled = false;
    void api
      .list<Memory>(`/memory_stores/${ws.resources.store}/memories`)
      .then((r) => {
        if (!canceled) setList(r);
      })
      .catch((e) => {
        if (!canceled) setError(errorText(e));
      });
    return () => {
      canceled = true;
    };
  }, [api, ws.resources.store, revision]);
  async function open(m: Memory) {
    const n = ++selection.current;
    setSelected(null);
    setOlder(null);
    setVersions([]);
    setError('');
    try {
      const detail = await api.request<Memory>(
        'GET',
        `/memory_stores/${ws.resources.store}/memories/${m.id}`,
      );
      const history = await api.list<MemoryVersion>(
        `/memory_stores/${ws.resources.store}/memory_versions`,
        { memory_id: m.id },
      );
      if (n === selection.current) {
        setSelected(detail);
        setDraft(detail.content ?? '');
        setVersions(history);
      }
    } catch (e) {
      if (n === selection.current) setError(errorText(e));
    }
  }
  return (
    <>
      <Heading
        eyebrow="MEMORY & CONTINUOUS IMPROVEMENT"
        title="让经验，有迹可循。"
      >
        长期记忆来自 QCA
        默认可写库。查看偏好、研究规则与复盘记录，比较实际版本。
      </Heading>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="memory-layout">
        <aside className="memory-list">
          <p className="list-label">
            长期记忆 <span>{list.length} 条</span>
          </p>
          {list.map((m) => (
            <button
              key={m.id}
              className={`memory-item ${selected?.id === m.id ? 'active' : ''}`}
              disabled={busy}
              onClick={() => void open(m)}
            >
              <Brain size={18} />
              <div>
                <strong>{memoryTitle(m.path)}</strong>
                <span>{m.path}</span>
              </div>
            </button>
          ))}
        </aside>
        <article className="memory-detail">
          {selected ? (
            <>
              <h2>{memoryTitle(selected.path)}</h2>
              <p className="secondary memory-path">{selected.path}</p>
              <p className="secondary">最新修改：{when(selected.updated_at)}</p>
              <label className="field-label" htmlFor="memory-content">
                当前记忆内容
              </label>
              <textarea
                id="memory-content"
                className="memory-editor"
                value={draft}
                disabled={busy || readOnly}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={busy || readOnly || draft === selected.content}
                onClick={() =>
                  void action(async () => {
                    const updated = await api.request<Memory>(
                      'POST',
                      `/memory_stores/${ws.resources.store}/memories/${selected.id}`,
                      {
                        content: draft,
                        content_sha256: selected.content_sha256,
                      },
                    );
                    setSelected(updated);
                    await open(updated);
                    refresh();
                  })
                }
              >
                保存修正到 QCA
              </Button>
              <p className="form-note">
                {readOnly
                  ? '复盘与方法记录由云端评测流程维护，此处只读查看。'
                  : '并发修改将返回冲突，避免覆盖 Agent'}
                的新记录。保存修正后由后续新会话读取。
              </p>
              <h3 className="revision-heading">版本历史</h3>
              <div className="versions-list">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    disabled={busy || v.redacted}
                    onClick={() =>
                      void action(async () => {
                        setOlder(
                          await api.request<MemoryVersion>(
                            'GET',
                            `/memory_stores/${ws.resources.store}/memory_versions/${v.id}`,
                          ),
                        );
                      })
                    }
                  >
                    <HistoryIcon />
                    <span>
                      {when(v.created_at)} · {v.operation}
                      {v.redacted ? ' · 内容已移除' : ''}
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              {older && (
                <section className="version-content">
                  <h3>历史版本 · {when(older.created_at)}</h3>
                  <Markdown text={older.content ?? '版本没有可读取内容。'} />
                </section>
              )}
            </>
          ) : (
            <Empty title="看看它记住了什么">
              选择一条记忆，查看正文和历史版本。修订记录代表方法变化，效果仍需证据验证。
            </Empty>
          )}
        </article>
      </div>
    </>
  );
}
function HistoryIcon() {
  return <FileText size={15} />;
}
export function Wechat({
  api,
  ws,
  revision,
  busy,
  action,
  onWorkspace,
  notify,
}: ViewProps &
  Actions & {
    onWorkspace: (w: Workspace) => void;
    notify: (s: string) => void;
  }) {
  const [channel, setChannel] = useState<Channel | null>(null),
    [qr, setQr] = useState<QrSession | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    if (ws.resources.channel)
      void api
        .request<Channel>('GET', `/channels/${ws.resources.channel}`)
        .then((c) => {
          if (!canceled) setChannel(c);
        })
        .catch((e) => {
          if (!canceled) setError(errorText(e));
        });
    return () => {
      canceled = true;
    };
  }, [api, ws, revision]);
  useEffect(() => {
    if (!qr?.session_key || !['waiting', 'scanned'].includes(qr.status)) return;
    let canceled = false;
    const timer = setTimeout(() => {
      void api
        .request<QrSession>(
          'GET',
          `/qr_sessions/${encodeURIComponent(qr.session_key)}`,
        )
        .then(async (q) => {
          if (canceled) return;
          if (q.status === 'confirmed' && channel) {
            const c = await api.request<Channel>(
              'GET',
              `/channels/${channel.id}`,
            );
            if (!canceled) setChannel(c);
          }
          if (!canceled)
            setQr((previous) => ({
              ...previous,
              ...q,
              qr_code_image_base64:
                q.qr_code_image_base64 ?? previous?.qr_code_image_base64,
            }));
        })
        .catch((e) => {
          if (!canceled) setError(errorText(e));
        });
    }, 2500);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [api, qr, channel]);
  return (
    <>
      <Heading
        eyebrow="DELIVERED TO YOUR EVERYDAY"
        title="到了时间，把功课送到微信。"
      >
        扫码连接小望，在微信里问进展、看报告，也可以接收每日汇报。
      </Heading>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <div className="channel-layout">
        <section className="panel channel-config">
          <h2>01 · 绑定微信</h2>
          <div className="configuration-row">
            <span>连接状态</span>
            <strong>{status(channel?.binding_status)}</strong>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const c = await ensureWechat(api, ws);
                setChannel(c);
                const refreshed = await restoreWorkspace(api);
                if (refreshed) onWorkspace(refreshed);
                setQr(await createQr(api, c.id));
                setError('');
              })
            }
          >
            {channel?.binding_status === 'bound'
              ? '重新授权'
              : '获取微信二维码'}
          </Button>
          {qr && (
            <div className="qr-box">
              {qr.qr_code_image_base64?.startsWith('data:image/') &&
              ['waiting', 'scanned'].includes(qr.status) ? (
                <Image
                  unoptimized
                  src={qr.qr_code_image_base64}
                  alt="微信授权二维码"
                  width={230}
                  height={230}
                />
              ) : null}
              <p>{status(qr.status)}</p>
              <small>有效期至 {when(qr.expires_at)}</small>
              {!qr.qr_code_image_base64 && qr.status === 'waiting' && (
                <p>接口未返回二维码图片，请在 QCA 控制台完成授权。</p>
              )}
            </div>
          )}
        </section>
        <section className="panel channel-config">
          <h2>02 · 开启微信推送</h2>
          <p className="reader-lead">扫码绑定后，在微信里先和小望说一句话。盘前报告和收盘汇报会发送到这个微信会话，无需填写接收人配置。</p>
          <Button
            className="solid-button"
            disabled={busy || channel?.binding_status !== 'bound'}
            onClick={() =>
              void action(async () => {
                if (!channel) throw new Error('请先绑定微信');
                const confirmed = await api.request<Channel>(
                  'GET',
                  `/channels/${channel.id}`,
                );
                if (!confirmed.enabled || confirmed.binding_status !== 'bound')
                  throw new Error('微信连接已失效，请重新授权。');
                const updated = await saveDelivery(api, ws, {
                  channel: channel.id,
                });
                onWorkspace(updated);
                notify(
                  '微信推送已保存。盘前研究和收盘汇报将使用已绑定渠道。',
                );
              })
            }
          >
            开启盘前与收盘推送
            <Check size={16} />
          </Button>
          <p className="form-note">
            请先在微信中发一条消息建立会话。是否实际送达，以每轮投递记录为准。
          </p>
        </section>
      </div>
    </>
  );
}
export function Plan({
  api,
  ws,
  busy,
  action,
  onWorkspace,
  notify,
}: ViewProps &
  Actions & {
    onWorkspace: (w: Workspace) => void;
    notify: (s: string) => void;
  }) {
  const [prefs, setPrefs] = useState<Preferences>(ws.preferences);
  return (
    <>
      <Heading
        eyebrow="SET IT ONCE, LET IT WORK"
        title="把研究，安排进每一天。"
      >
        计划和用户偏好保存到 QCA，前端离线后仍按云端计划执行。
      </Heading>
      <div className="settings-layout">
        <section className="panel settings-main">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                if (!ws.resources.channel)
                  throw new Error('请先绑定微信并保存通知目标。');
                const c = await api.request<Channel>(
                  'GET',
                  `/channels/${ws.resources.channel}`,
                );
                if (!c.enabled || c.binding_status !== 'bound')
                  throw new Error('微信连接不可用，请先重新绑定。');
                const updated = await savePreferences(
                  api,
                  ws,
                  prefs,
                  {
                    channel: c.id,
                    ...(ws.identity.metadata.wt_target ? { target: parseTarget(ws.identity.metadata.wt_target) } : {}),
                  },
                  true,
                );
                onWorkspace(updated);
                const s = await getSchedule(api, ws.resources.schedule!);
                if (s.status === 'paused')
                  await api.request('POST', `/schedules/${s.id}/unpause`);
                notify(
                  '每日计划已写入 QCA。请在云端值守查看下次执行时间，并完成一次真实运行验收。',
                );
              });
            }}
          >
            <fieldset disabled={busy}>
              <div className="settings-section">
                <h2>研究范围</h2>
                <label htmlFor="watchlist">关注股票 / 行业</label>
                <textarea
                  id="watchlist"
                  maxLength={500}
                  className="target-editor"
                  required
                  value={prefs.watchlist}
                  onChange={(e) =>
                    setPrefs({ ...prefs, watchlist: e.target.value })
                  }
                />
                <div className="settings-fields">
                  <div>
                    <label htmlFor="time">开始时间 · 北京时间</label>
                    <input
                      id="time"
                      type="time"
                      required
                      value={prefs.time}
                      onChange={(e) =>
                        setPrefs({ ...prefs, time: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="frequency">执行频率</label>
                    <select
                      id="frequency"
                      value={prefs.frequency}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          frequency: e.target.value as Preferences['frequency'],
                        })
                      }
                    >
                      <option value="weekdays">每个工作日</option>
                      <option value="daily">每天（含周末）</option>
                    </select>
                  </div>
                </div>
                <p className="form-note">
                  工作日不等于交易日。非交易日可研究公告与资讯，并明确没有新行情。
                </p>
              </div>
              <div className="settings-section">
                <h2>已配置的数据工具</h2>
                <div className="integration-list">
                  {IFIND_SERVICES.map((s) => (
                    <div key={s.name}>
                      <BookOpen size={18} />
                      <span>
                        <strong>同花顺 · {s.label}</strong>
                        <small>
                          {s.tools.length} 个研究工具 · 凭证存于 QCA Vault
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="configuration-row">
                  <span>每轮任务</span>
                  <strong>新 Session · 复用长期记忆</strong>
                </div>
                <div className="configuration-row">
                  <span>结果</span>
                  <strong>Drive 报告 + 微信摘要</strong>
                </div>
                <Button
                  type="submit"
                  className="solid-button connect-button"
                  disabled={busy}
                >
                  保存并启用每日研究
                  <ArrowRight size={16} />
                </Button>
              </div>
            </fieldset>
          </form>
        </section>
        <aside className="settings-aside">
          <section className="connection-note">
            <Cloud size={27} />
            <h2>
              研究在云端，
              <br />
              经验也在云端。
            </h2>
            <p>
              每轮读取已有偏好与问题，再查询资料、核验、归档、复盘。可以验证的方法改进进入后续任务，未经证实的变化保持候选。
            </p>
            <ul>
              <li>
                <Check size={15} />
                不需要每天重新提问
              </li>
              <li>
                <Check size={15} />
                不依赖本地定时器
              </li>
              <li>
                <Check size={15} />
                不执行股票交易
              </li>
            </ul>
          </section>
          <section className="technical-note">
            <ShieldCheck size={20} />
            <h3>真实可用的验收</h3>
            <p>
              启用后关闭页面，检查下一次云端运行、Drive
              报告和微信送达。只有三者都成功，才证明完整链路可用。
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
