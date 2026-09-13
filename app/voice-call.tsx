'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Send,
  RotateCcw,
} from 'lucide-react';
import { useVoiceSession } from '@/lib/voice/useVoiceSession';
import { type RealtimeVoice, REALTIME_VOICES } from '@/lib/voice/voiceApi';
import { type QcaClient } from '@/lib/qca';
import { type Workspace } from '@/lib/workflow';
import { CompanionAvatar } from './companion-avatar';
const labels: Record<string, string> = {
  idle: '准备通话',
  'loading-history': '正在读取上次通话',
  connecting: '正在连接',
  listening: '我在听',
  thinking: '正在查阅',
  speaking: '正在向你说明',
  reconnecting: '正在恢复连接',
  ending: '正在保存通话',
  ended: '通话已结束',
  error: '连接遇到了问题',
};
export function VoiceCall({
  initialPrompt = '',
  api,
  ws,
  onClose,
  onConversation,
}: {
  initialPrompt?: string;
  api: QcaClient;
  ws: Workspace;
  onClose: () => void;
  onConversation: (id: string) => void;
}) {
  const [voice, setVoice] = useState<RealtimeVoice>('longanqian');
  const [mode, setMode] = useState<'new' | 'text' | 'history' | null>(null);
  if (!mode)
    return (
      <div className="voice-prepare">
        <CompanionAvatar state="idle" compact />
        <p className="eyebrow">和小望聊聊</p>
        <h2>
          听简报，追问依据，
          <br />
          也可以交代新的事情。
        </h2>
        <p>{initialPrompt ? '接通后，小望会读取最近的研究成果，先说报告日期，再讲重点。' : '通话保存在云端。结束通话不会暂停已启用的研究计划。'}</p>
        <label htmlFor="voice-choice">选择声音</label>
        <select
          id="voice-choice"
          value={voice}
          onChange={(e) => setVoice(e.target.value as RealtimeVoice)}
        >
          {REALTIME_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button className="call-button" onClick={() => setMode('new')}>
          {initialPrompt ? '开始通话，听研究简报' : '开始新通话'}
        </button>
        <div className="voice-alternatives">
          <button className="text-action" onClick={() => setMode('text')}>
            先用文字交流
          </button>
          {ws.identity.metadata.wt_voice && (
            <button className="text-action" onClick={() => setMode('history')}>
              查看 / 继续上次通话
            </button>
          )}
        </div>
        <button className="text-action" onClick={onClose}>
          稍后再聊
        </button>
      </div>
    );
  return (
    <ActiveCall
      initialPrompt={initialPrompt}
      api={api}
      ws={ws}
      voice={voice}
      mode={mode}
      onClose={onClose}
      onConversation={onConversation}
    />
  );
}
function ActiveCall({
  initialPrompt,
  api,
  ws,
  voice,
  mode,
  onClose,
  onConversation,
}: {
  initialPrompt: string;
  api: QcaClient;
  ws: Workspace;
  voice: RealtimeVoice;
  mode: 'new' | 'text' | 'history';
  onClose: () => void;
  onConversation: (id: string) => void;
}) {
  const ctx = useMemo(() => ({ api }), [api]);
  const [draft, setDraft] = useState('');
  const [startError, setStartError] = useState('');
  const session = useVoiceSession({
    ctx,
    identityId: ws.identity.id,
    templateId: ws.resources.voiceTemplate || ws.resources.template!,
    selectedVoice: voice,
    initialConversationId:
      mode === 'history' ? ws.identity.metadata.wt_voice : null,
    captureAudio: mode !== 'text',
    autoStart: mode !== 'history',
    launchKey: 1,
    onConversationCreated: onConversation,
    onStartFailed: setStartError,
  });
  const active = ['listening', 'thinking', 'speaking'].includes(session.stage);
  const sentBrief = useRef(false);
  const { stage, sendText } = session;
  useEffect(() => {
    if (initialPrompt && mode !== 'history' && stage === 'listening' && !sentBrief.current) {
      if (sendText(initialPrompt)) sentBrief.current = true;
    }
  }, [initialPrompt, mode, stage, sendText]);
  const captions = session.timeline
    .filter((t) => t.kind === 'caption')
    .slice(-2);
  const tasks = session.timeline.filter((t) => t.kind === 'work');
  return (
    <section className="voice-room">
      <div className="voice-heading">
        <span className="eyebrow">与小望通话</span>
        <output className="voice-stage">{labels[session.stage]}</output>
      </div>
      <CompanionAvatar state={session.stage} compact />
      <div className="voice-captions" aria-live="polite">
        {captions.length ? (
          captions.map(
            (c) =>
              c.kind === 'caption' && (
                <p key={c.id} className={c.role}>
                  <span>{c.role === 'user' ? '你' : '小望'}</span>
                  {c.text}
                </p>
              ),
          )
        ) : (
          <p className="voice-prompt">“先告诉我，今天有什么值得关注？”</p>
        )}
      </div>
      {(session.error || startError) && (
        <div className="error-banner" role="alert">
          {session.error || startError}
        </div>
      )}
      {session.microphoneWarning && (
        <p className="form-note">
          {session.microphoneWarning}，你仍可以在下方打字。
        </p>
      )}
      {session.historyWarning && (
        <div className="form-note" role="status">{session.historyWarning}<button className="text-action" onClick={() => void session.refreshHistory()}>重新加载记录</button></div>
      )}
      {tasks.length > 0 && (
        <details className="voice-work">
          <summary>通话中的任务 · {tasks.length}</summary>
          {tasks.map(
            (t) =>
              t.kind === 'work' && (
                <article key={t.id}>
                  <strong>{workTitle(t.objective)}</strong>
                  <p>{t.result || workStatus(t.status, stage === 'ended')}</p>
                </article>
              ),
          )}
        </details>
      )}
      <form
        className="voice-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (session.sendText(draft)) setDraft('');
        }}
      >
        <input
          aria-label="向小望发送文字"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="也可以打字说……"
          disabled={!active}
        />
        <button disabled={!active || !draft.trim()} aria-label="发送">
          <Send size={18} />
        </button>
      </form>
      <details className="voice-work voice-history">
        <summary>完整通话记录</summary>
        {session.timeline.map((entry) =>
          entry.kind === 'caption' ? (
            <p key={entry.id}>
              <strong>{entry.role === 'user' ? '你' : '小望'}：</strong>
              {entry.text}
            </p>
          ) : (
            <article key={entry.id}>
              <strong>{workTitle(entry.objective)}</strong>
              <p>{entry.result || workStatus(entry.status, stage === 'ended')}</p>
            </article>
          ),
        )}
      </details>
      <div className="call-controls">
        <button
          aria-pressed={mode === 'text' || session.muted}
          disabled={!active || mode === 'text'}
          onClick={() => session.setMuted(!session.muted)}
        >
          {session.muted ? <MicOff /> : <Mic />}
          <span>
            {mode === 'text'
              ? '麦克风未开启'
              : session.muted
                ? '取消静音'
                : '静音'}
          </span>
        </button>
        <button
          className="hang-up"
          data-end-call="true"
          disabled={session.stage === 'ending'}
          onClick={() =>
            session.stage === 'ended' ? onClose() : void session.end()
          }
        >
          <PhoneOff />
          <span>{stage === 'ended' ? '返回' : '挂断'}</span>
        </button>
        <button
          aria-pressed={session.speakerMuted}
          disabled={!active}
          onClick={() => session.setSpeakerMuted(!session.speakerMuted)}
        >
          {session.speakerMuted ? <VolumeX /> : <Volume2 />}
          <span>{session.speakerMuted ? '开启声音' : '扬声器'}</span>
        </button>
      </div>
      {['error', 'ended'].includes(session.stage) && (
        <button
          className="text-action"
          onClick={() =>
            void (session.conversationId
              ? session.continueConversation()
              : session.startNew())
          }
        >
          <RotateCcw size={16} />
          重新连接
        </button>
      )}
      <p className="voice-footer">结束通话，云端计划继续。</p>
    </section>
  );
}

function workTitle(objective: string) {
  return objective.includes('/data/') ? '读取研究资料与复盘记录' : objective;
}
function workStatus(status: string, ended: boolean) {
  const labels: Record<string, string> = {completed: '已完成', failed: '执行失败', cancelled: '已取消', accepted: '已安排', running: '正在处理'};
  if (ended && ['running', 'accepted'].includes(status)) return '上次状态：处理中，正在同步云端结果';
  return labels[status] || '正在更新状态';
}
