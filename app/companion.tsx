'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Cloud,
  Phone,
  ArrowRight,
  Settings2,
  FolderOpen,
  Brain,
  MessageCircle,
  RefreshCw,
  X,
  LogOut,
  Check,
  Search,
  FlaskConical,
  Sunrise,
  ChevronDown,
} from 'lucide-react';
import {
  QcaClient,
  type Region,
  type Schedule,
  type Run,
  type Identity,
  type Memory,
} from '@/lib/qca';
import {
  bootstrap,
  configureIfind,
  restoreWorkspace,
  type Workspace,
} from '@/lib/workflow';
import { ensureLoop } from '@/lib/loop';
import { isRecurring, methodStatus, methodLesson } from '@/lib/loop-status';
import { Reports, Memories, Wechat } from './live';
import { CompanionAvatar } from './companion-avatar';
import { VoiceCall } from './voice-call';
import { LoopSettings } from './loop-settings';
import { WorkHistory } from './work-history';
import { ResearchAssets } from './research-assets';
import { ReplayRounds } from './replay-rounds';
import { LatestResearch } from './latest-research';
import { MethodInsight } from './method-insight';
const titles: Record<string, string> = {
  settings: '研究计划',
  reports: '报告档案',
  memory: '长期记忆',
  channel: '微信通知',
  runs: '工作记录',
  call: '和小望通话',
  latest: '最近研究成果',
  insight: '这次学到了什么',
};
const dock = [
  { id: 'settings', label: '计划', icon: Settings2 },
  { id: 'reports', label: '档案', icon: FolderOpen },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'channel', label: '通知', icon: MessageCircle },
];
function readable(e: unknown) {
  return e instanceof Error ? e.message : '操作未完成，请稍后重试。';
}
function clock(value?: string) {
  return value
    ? new Date(value).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '尚未安排';
}
function Drawer({
  kind,
  onClose,
  children,
}: {
  kind: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const requestClose = () => {
    const end =
      ref.current?.querySelector<HTMLButtonElement>('[data-end-call]');
    if (kind === 'call' && end) end.click();
    else onClose();
  };
  return (
    <dialog
      ref={ref}
      className={`companion-drawer ${kind === 'call' ? 'call-drawer' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <header className="drawer-header">
        <span>{titles[kind]}</span>
        {
          <button
            className="icon-button"
            onClick={requestClose}
            aria-label="关闭面板"
          >
            <X size={20} />
          </button>
        }
      </header>
      <div className="drawer-body">{children}</div>
    </dialog>
  );
}
export default function CompanionApp() {
  const [voicePrompt, setVoicePrompt] = useState('');
  const [api, setApi] = useState<QcaClient | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [region, setRegion] = useState<Region>('global');
  const [pat, setPat] = useState('');
  const [ifind, setIfind] = useState('');
  const [panel, setPanel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [reviewRun, setReviewRun] = useState<Run | null>(null);
  const [deliveryRun, setDeliveryRun] = useState<Run | null>(null);
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null);
  const [policyError, setPolicyError] = useState('');
  const [memoryRole, setMemoryRole] = useState('research');
  const [syncError, setSyncError] = useState('');
  const [syncedAt, setSyncedAt] = useState<string>();
  const lock = useRef(false);
  const action = useCallback(async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(readable(e));
    } finally {
      setBusy(false);
      lock.current = false;
      setProgress('');
    }
  }, []);
  useEffect(() => {
    if (!api || !ws?.resources.schedule) return;
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [s, r, review, delivery] = await Promise.all([
          api.request<Schedule>('GET', '/schedules/' + ws.resources.schedule),
          api.request<{ data: Run[] }>('GET', '/schedule_runs', undefined, {
            identity_id: ws.identity.id,
            schedule_id: ws.resources.schedule,
            limit: 10,
          }),
          ws.resources.reviewSchedule
            ? api.request<{ data: Run[] }>('GET', '/schedule_runs', undefined, {
                identity_id: ws.identity.id,
                schedule_id: ws.resources.reviewSchedule,
                limit: 5,
              })
            : Promise.resolve({ data: [] }),
          ws.resources.deliverySchedule
            ? api.request<{ data: Run[] }>('GET', '/schedule_runs', undefined, {
                identity_id: ws.identity.id,
                schedule_id: ws.resources.deliverySchedule,
                limit: 5,
              })
            : Promise.resolve({ data: [] }),
        ]);
        if (canceled) return;
        setSchedule(s);
        setRuns(r.data);
        setReviewRun(review.data[0] ?? null);
        setDeliveryRun(delivery.data[0] ?? null);
        setSyncError('');
        setSyncedAt(new Date().toISOString());
      } catch (e) {
        if (!canceled) setSyncError(readable(e));
      } finally {
        if (!canceled) timer = setTimeout(() => void refresh(), 15000);
      }
    };
    void refresh();
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [api, ws, revision]);
  useEffect(() => {
    if (!api || !ws?.resources.reviewStore) return;
    let canceled = false;
    void api
      .list<Memory>(`/memory_stores/${ws.resources.reviewStore}/memories`)
      .then(async (items) => {
        const entry = items.find(
          (m) => m.path === 'governance/active-policy.json',
        );
        if (!entry) return null;
        const detail = await api.request<Memory>(
          'GET',
          `/memory_stores/${ws.resources.reviewStore}/memories/${entry.id}`,
        );
        return JSON.parse(detail.content || 'null') as Record<
          string,
          unknown
        > | null;
      })
      .then((value) => {
        if (!canceled) {
          setPolicy(value);
          setPolicyError('');
        }
      })
      .catch(() => {
        if (!canceled) setPolicyError('方法记录暂时无法读取');
      });
    return () => {
      canceled = true;
    };
  }, [api, ws, reviewRun?.id, reviewRun?.status, revision]);
  async function connect() {
    await action(async () => {
      const client = new QcaClient(region, pat);
      setProgress('正在连接你的云端空间');
      await client.request('GET', '/models');
      let workspace = await restoreWorkspace(client);
      if (!workspace?.resources.schedule || !workspace.resources.store) {
        const zip = await fetch('/watchtower-research.zip');
        if (!zip.ok) throw new Error('研究技能包暂时不可用。');
        workspace = await bootstrap(
          client,
          ifind,
          await zip.blob(),
          setProgress,
        );
      } else if (ifind.trim())
        await configureIfind(
          client,
          workspace.resources.vault!,
          workspace.identity.id,
          ifind,
          setProgress,
        );
      if (workspace.identity.metadata.wt_loop_version !== '3') {
        const zip = await fetch('/watchtower-research.zip');
        if (!zip.ok) throw new Error('复盘工具包暂时不可用。');
        workspace = await ensureLoop(
          client,
          workspace,
          await zip.blob(),
          setProgress,
        );
      }
      setApi(client);
      setWs(workspace);
      setPat('');
      setIfind('');
      setNotice('已连接你的云端空间。');
    });
  }
  const open = (id: string) => {
    if (busy) return;
    setPanel(id);
    setError('');
    setNotice('');
  };
  const reviewActive =
    reviewRun && ['pending', 'running'].includes(reviewRun.status);
  const deliveryActive =
    deliveryRun && ['pending', 'running'].includes(deliveryRun.status);
  const active =
    runs.find((r) => ['pending', 'running'].includes(r.status)) ||
    (reviewActive ? reviewRun : undefined) ||
    (deliveryActive ? deliveryRun : undefined);
  const methodLabel = policyError || methodStatus(policy);
  const latest = runs[0];
  const scheduled = isRecurring(schedule);
  const state = syncError
    ? 'disconnected'
    : active
      ? 'working'
      : latest?.status === 'failed'
        ? 'attention'
        : 'idle';
  const heading = !api
    ? '你离开后，\n研究还会继续。'
    : syncError
      ? '上次的状态，\n还需要更新。'
      : active
        ? reviewActive
          ? '正在检查判断，\n把依据再看一遍。'
          : deliveryActive
            ? '研究与复盘，\n正在整理给你。'
            : '正在做功课，\n稍后向你汇报。'
        : latest?.status === 'failed'
          ? '这轮遇到一个问题，\n需要看看原因。'
          : scheduled
            ? '下一轮，\n我会按时开始。'
            : '今天的研究，\n从你的安排开始。';
  const props = api && ws ? { api, ws, revision } : null;
  const updateWorkspace = (value: Workspace) => {
    setWs(value);
    setRevision((r) => r + 1);
  };
  return (
    <div className="companion-app">
      <div className="ambient-window" aria-hidden="true" />
      <header className="companion-header">
        <a className="companion-wordmark" href="#main">
          小望<span>WATCHTOWER</span>
        </a>
        <div className="connection-status">
          <Cloud size={17} />
          <span>
            {!api
              ? '你的云端研究伙伴'
              : syncError
                ? '状态待同步'
                : active
                  ? '云端执行中'
                  : scheduled
                    ? '云端计划已启用'
                    : '已连接 · 等待安排'}
          </span>
          {api && (
            <button
              className="icon-button"
              disabled={busy}
              aria-label="刷新云端状态"
              onClick={() => setRevision((r) => r + 1)}
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
        {api && (
          <button
            className="icon-button account-exit"
            aria-label="断开本页连接"
            disabled={busy || panel === 'call'}
            onClick={() => {
              setApi(null);
              setWs(null);
              setSchedule(null);
              setRuns([]);
              setSyncedAt(undefined);
              setPanel(null);
            }}
          >
            <LogOut size={18} />
          </button>
        )}
      </header>
      <main id="main" className="companion-main">
        <section className={`companion-stage ${api ? 'connected' : 'welcome'}`}>
          <div className="companion-intro">
            <p className="eyebrow">
              {api ? 'YOUR RESEARCH COMPANION' : 'A LITTLE SPACE FOR BIG IDEAS'}
            </p>
            <h1>
              {heading.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>
            <p className="stage-note">
              {!api
                ? '交代一次，持续研究。\n让每一轮，带着上一轮的经验出发。'
                : syncError
                  ? syncError
                  : active
                    ? '任务在 QCA 云端执行，关闭页面不会停止这一轮。'
                    : scheduled
                      ? `下次研究：${clock(schedule?.trigger_policy.upcoming_runs_at?.[0])}`
                      : '配置计划后，小望会在云端按时执行。'}
            </p>
            {api && (
              <div className="stage-actions">
                <button
                  className="call-button"
                  disabled={busy}
                  onClick={() => { setVoicePrompt(''); open('call'); }}
                >
                  <Phone size={20} />
                  给小望打电话
                </button>
                <button className="text-action" onClick={() => open('runs')}>
                  看看它做了什么 <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="avatar-scene">
            <CompanionAvatar state={state} />
            {api && <button className="companion-im-entry" onClick={() => open('channel')}><MessageCircle size={22} /><span><strong>在微信里找小望</strong><small>连接 IM · 收报告 · 问进展</small></span><ArrowRight size={18} /></button>}
            <div className="scene-note">
              <span className={`state-dot ${state}`} />
              {!api
                ? '在云端，等你的第一件事'
                : active
                  ? '正在核对资料与来源'
                  : scheduled
                    ? '安静待命，按时开始'
                    : '准备好后，交给我'}
            </div>
          </div>
          {!api && (
            <form
              className="connection-form"
              onSubmit={(e) => {
                e.preventDefault();
                void connect();
              }}
            >
              <h2>连接你的研究空间</h2>
              <p>已有配置会从 QCA 恢复。</p>
              <fieldset disabled={busy}>
                <label htmlFor="companion-region">服务区域</label>
                <select
                  id="companion-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                >
                  <option value="global">海外 QCA</option>
                  <option value="cn">国内 QCA</option>
                </select>
                <label htmlFor="companion-key">QCA Key</label>
                <input
                  id="companion-key"
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  autoComplete="off"
                  required
                  placeholder="输入对应区域的 API Key"
                />
                <label htmlFor="companion-ifind">
                  同花顺 MCP Key <small>首次连接填写</small>
                </label>
                <input
                  id="companion-ifind"
                  type="password"
                  value={ifind}
                  onChange={(e) => setIfind(e.target.value)}
                  autoComplete="off"
                  placeholder="留空沿用云端凭据"
                />
                <button className="warm-button" type="submit">
                  {busy ? progress : '连接我的研究空间'}{' '}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </fieldset>
              <p className="credential-note">
                QCA Key 仅保留在本页内存；同花顺凭据存入你的 QCA 保险箱。
              </p>
            </form>
          )}
        </section>
        {api && (
          <section className="loop-space">
            <div className="loop-heading">
              <div>
                <p className="eyebrow">ONE ROUND LEADS TO THE NEXT</p>
                <h2>每一轮，都有来路和下一步。</h2>
              </div>
              <button className="text-action" onClick={() => open('settings')}>
                调整计划 <Settings2 size={15} />
              </button>
            </div>
            <div className="loop-track">
              <svg className="loop-return" viewBox="0 0 1000 230" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="loop-return-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="currentColor" /></marker></defs><path d="M125 26 H875 Q985 26 985 108 V170 Q985 210 930 210 H70 Q15 210 15 170 V100 Q15 26 100 26" markerEnd="url(#loop-return-arrow)" /></svg>
              <button onClick={() => open('runs')}>
                <span
                  className={`loop-node ${latest?.status === 'completed' ? 'done' : active ? 'current' : ''}`}
                >
                  {latest?.status === 'completed' ? <Check /> : <Search />}
                </span>
                <strong>
                  {active
                    ? '研究进行中'
                    : latest?.status === 'completed'
                      ? '本轮研究已完成'
                      : '研究'}
                </strong>
                <small>
                  {latest ? clock(latest.triggered_at) : '等待首次执行'}
                </small>
              </button>
              <button onClick={() => open('runs')}>
                <span className="loop-node">
                  <RefreshCw />
                </span>
                <strong>独立复盘</strong>
                <small>
                  {reviewActive
                    ? '正在检查证据'
                    : reviewRun
                      ? reviewRun.status === 'failed'
                        ? '本轮复盘失败'
                        : `最近执行 ${clock(reviewRun.triggered_at)}`
                      : '等待首次复盘'}
                </small>
              </button>
              <button onClick={() => open('memory')}>
                <span className="loop-node">
                  <FlaskConical />
                </span>
                <strong>沉淀经验</strong>
                <small>{methodLabel}</small>
              </button>
              <button onClick={() => open('settings')}>
                <span className="loop-node">
                  <Sunrise />
                </span>
                <strong>下一轮研究</strong>
                <small>
                  {scheduled
                    ? clock(schedule?.trigger_policy.upcoming_runs_at?.[0])
                    : '尚未安排'}
                </small>
              </button>
            </div>
            <p className="loop-return-label">带着上轮经验，开始下一个工作日 ↻</p>
            <button className="loop-evidence" onClick={() => open('insight')}>
              <Brain size={18} />
              <span><strong>这次学到了什么</strong><br />{methodLesson(policy)}<br /><small>{methodLabel} · 查看依据</small></span>
              <ChevronDown size={17} />
            </button>
            <p className="stage-note">每天留下研究批次、报告与复盘；方法有验证后的改变，才更新版本。</p>
            <div className="latest-actions"><button className="warm-button" onClick={() => open('latest')}><FolderOpen size={18} />读最新报告</button><button className="text-action" onClick={() => { setVoicePrompt('请读取最新已归档研究报告，用一分钟概括新增发现、待核实问题和复盘变化，先说明报告日期。没有证据就明确说明，不重新执行研究。'); open('call'); }}><Phone size={18} />听一分钟总结</button></div>
            <ResearchAssets onReports={() => open('reports')} onMemory={() => open('memory')} />
            {ws && <ReplayRounds api={api} ws={ws} />}
          </section>
        )}
        {(error || notice || busy) && (
          <div className="global-message" role={error ? 'alert' : 'status'}>
            {error || progress || notice}
          </div>
        )}
      </main>
      <footer className="companion-footer">
        {api ? (
          <nav aria-label="工作空间">
            {dock.map((d) => (
              <button
                key={d.id}
                disabled={busy}
                onClick={() => open(d.id)}
                aria-current={panel === d.id ? 'page' : undefined}
              >
                <d.icon size={20} />
                {d.label}
              </button>
            ))}
          </nav>
        ) : (
          <span>研究、复盘与经验，保存在你的云端空间。</span>
        )}
        <small>
          {syncedAt ? `最近同步 ${clock(syncedAt)}` : 'POWERED BY QCA FORWARD'}
        </small>
      </footer>
      {panel && props && (
        <Drawer
          kind={panel}
          onClose={() => {
            if (!busy) setPanel(null);
          }}
        >
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          {notice && <output className="notice-banner">{notice}</output>}
          {panel === 'reports' && <Reports {...props} />}{' '}
          {panel === 'insight' && <MethodInsight policy={policy} onRecords={() => { setMemoryRole('review'); open('memory'); }} />}
          {panel === 'latest' && ws?.resources.store && <LatestResearch api={api!} identity={ws.identity.id} store={ws.resources.store} onListen={() => { setVoicePrompt('请读取最新已归档研究报告，用一分钟概括新增发现、待核实问题和复盘变化，先说明报告日期。没有证据就明确说明，不重新执行研究。'); open('call'); }} />}
          {panel === 'memory' && (
            <>
              <fieldset className="memory-role-tabs" aria-label="记忆归属">
                {[
                  { id: 'research', label: '偏好与研究' },
                  { id: 'review', label: '复盘与方法' },
                  { id: 'voice', label: '通话反馈' },
                  ...(props.ws.identity.metadata.wt_replay_store ? [{ id: 'replay', label: '历史回放' }] : []),
                ].map((role) => (
                  <button
                    key={role.id}
                    aria-pressed={memoryRole === role.id}
                    onClick={() => setMemoryRole(role.id)}
                  >
                    {role.label}
                  </button>
                ))}
              </fieldset>
              <Memories
                {...props}
                key={memoryRole}
                ws={{
                  ...props.ws,
                  resources: {
                    ...props.ws.resources,
                    store:
                      memoryRole === 'replay'
                        ? props.ws.identity.metadata.wt_replay_store
                        : memoryRole === 'review'
                        ? props.ws.resources.reviewStore
                        : memoryRole === 'voice'
                          ? props.ws.resources.voiceStore
                          : props.ws.resources.store,
                  },
                }}
                readOnly={memoryRole === 'review' || memoryRole === 'replay'}
                busy={busy}
                action={action}
                refresh={() => setRevision((r) => r + 1)}
              />
            </>
          )}{' '}
          {panel === 'channel' && (
            <Wechat
              {...props}
              busy={busy}
              action={action}
              onWorkspace={updateWorkspace}
              notify={setNotice}
            />
          )}{' '}
          {panel === 'settings' && (
            <LoopSettings
              {...props}
              busy={busy}
              action={action}
              onWorkspace={updateWorkspace}
              notify={setNotice}
            />
          )}{' '}
          {panel === 'runs' && <WorkHistory {...props} />}
          {panel === 'call' && (
            <VoiceCall
              initialPrompt={voicePrompt}
              api={props.api}
              ws={props.ws}
              onClose={() => setPanel(null)}
              onConversation={(id) => {
                void props.api
                  .request<Identity>(
                    'POST',
                    '/identities/' + props.ws.identity.id,
                    { metadata: { wt_voice: id } },
                  )
                  .then((identity) =>
                    setWs((w) => (w ? { ...w, identity } : w)),
                  )
                  .catch(() => setNotice('通话已建立，最近通话入口暂未保存。'));
              }}
            />
          )}
        </Drawer>
      )}
    </div>
  );
}
