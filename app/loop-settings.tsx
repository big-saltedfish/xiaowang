'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  Play,
  Check,
  MessageCircle,
  ArrowRight,
  Pause,
} from 'lucide-react';
import { QcaClient, type Schedule, type Channel, parseTarget } from '@/lib/qca';
import { type Workspace, runNow } from '@/lib/workflow';
import { loopPreferences, saveLoop, type LoopPreferences } from '@/lib/loop';
export function LoopSettings({
  api,
  ws,
  busy,
  action,
  onWorkspace,
  notify,
}: {
  api: QcaClient;
  ws: Workspace;
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  onWorkspace: (w: Workspace) => void;
  notify: (s: string) => void;
}) {
  const [prefs, setPrefs] = useState<LoopPreferences>(() =>
    loopPreferences(ws),
  );
  const [plans, setPlans] = useState<Schedule[]>([]);
  const [error, setError] = useState('');
  const [rev, setRev] = useState(0);
  const phases = useMemo(
    () => [
      {
        id: ws.resources.schedule,
        label: '研究',
        detail: '整理资料，留下可验证的判断',
      },
      {
        id: ws.resources.reviewSchedule,
        label: '独立复盘',
        detail: '检查新证据，固定脚本评测改法',
      },
      {
        id: ws.resources.deliverySchedule,
        label: '汇报',
        detail: '合并研究与复盘，送到微信',
      },
    ],
    [
      ws.resources.schedule,
      ws.resources.reviewSchedule,
      ws.resources.deliverySchedule,
    ],
  );
  useEffect(() => {
    let canceled = false;
    void Promise.all(
      phases
        .filter((p) => p.id)
        .map((p) => api.request<Schedule>('GET', '/schedules/' + p.id)),
    )
      .then((values) => {
        if (!canceled) {
          setPlans(values);
          setError('');
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [api, phases, rev]);
  return (
    <section className="loop-settings">
      <p className="eyebrow">安排一次，持续接续</p>
      <h1>给每一轮，留出下一步。</h1>
      <p className="settings-lead">
        研究、复盘与汇报分别在云端执行。复盘会检查前一轮的完整证据，缺失时明确等待，不用旧报告冒充新结果。
      </p>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {ws.identity.metadata.wt_loop_save === 'pending' && (
        <div className="error-banner">
          上次保存尚未全部完成。下面展示云端实际状态，可重新保存恢复配置。
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            let delivery;
            if (ws.resources.channel && (ws.identity.metadata.wt_target || ws.identity.metadata.wt_im_enabled === 'true')) {
              const c = await api.request<Channel>(
                'GET',
                '/channels/' + ws.resources.channel,
              );
              if (!c.enabled || c.binding_status !== 'bound')
                throw new Error(
                  '已有微信接收目标，但渠道不可用。请先重新绑定或清除通知目标。',
                );
              delivery = {
                channel: c.id,
                ...(ws.identity.metadata.wt_target ? { target: parseTarget(ws.identity.metadata.wt_target) } : {}),
              };
            }
            const updated = await saveLoop(api, ws, prefs, delivery);
            onWorkspace(updated);
            setRev((r) => r + 1);
            notify(
              prefs.enabled
                ? '三个云端计划已保存并启用。请检查下次运行时间。'
                : '配置已保存，计划保持手动运行。',
            );
          });
        }}
      >
        <fieldset disabled={busy}>
          <label className="field-label" htmlFor="loop-watchlist">
            关注股票 / 行业
          </label>
          <textarea
            id="loop-watchlist"
            className="target-editor"
            maxLength={500}
            required
            value={prefs.watchlist}
            onChange={(e) => setPrefs({ ...prefs, watchlist: e.target.value })}
          />
          <div className="loop-times">
            {[
              { key: 'time', label: '开始研究' },
              { key: 'reviewTime', label: '收盘复盘' },
              { key: 'deliveryTime', label: '汇总交付' },
            ].map((f) => (
              <label key={f.key}>
                <Clock size={16} />
                {f.label}
                <input
                  aria-label={f.label}
                  type="time"
                  required
                  value={prefs[f.key as 'time' | 'reviewTime' | 'deliveryTime']}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="plan-options">
            <label>
              频率
              <select
                value={prefs.frequency}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    frequency: e.target.value as 'daily' | 'weekdays',
                  })
                }
              >
                <option value="weekdays">每个工作日</option>
                <option value="daily">每天（含周末）</option>
              </select>
            </label>
            <label className="enable-plan">
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, enabled: e.target.checked })
                }
              />
              启用自动执行
            </label>
          </div>
          <p className="form-note">
            时间均为北京时间。阶段之间至少间隔20分钟；非交易日仍可研究公告与资讯。
          </p>
          <div className="delivery-note">
            <MessageCircle size={18} />
            {ws.identity.metadata.wt_target
              ? '汇报将发送到已保存的微信会话。'
              : '尚未设置微信接收目标。研究和复盘可以先运行，报告保存在云端。'}
          </div>
          <button type="submit" className="warm-button">
            <Check size={18} />
            保存完整计划
            <ArrowRight size={16} />
          </button>
        </fieldset>
      </form>
      <div className="phase-controls">
        <h2>查看实际计划，或单独跑一轮</h2>
        {phases.map((phase) => {
          const p = plans.find((p) => p.id === phase.id);
          return (
            <div className="phase-control" key={phase.label}>
              <div>
                <strong>{phase.label}</strong>
                <p>{phase.detail}</p>
                <small>
                  {!p
                    ? '读取中'
                    : p.status === 'paused'
                      ? '已暂停'
                      : p.trigger_policy.type === 'manual'
                        ? '手动执行'
                        : `下次：${p.trigger_policy.upcoming_runs_at?.[0] ? new Date(p.trigger_policy.upcoming_runs_at[0]).toLocaleString('zh-CN') : '等待计算'}`}
                </small>
              </div>
              <button
                disabled={busy || !phase.id}
                className="icon-button"
                aria-label={'立即执行' + phase.label}
                onClick={() =>
                  void action(async () => {
                    await runNow(api, phase.id!, crypto.randomUUID());
                    notify(phase.label + '已提交到云端。');
                    setRev((r) => r + 1);
                  })
                }
              >
                <Play size={18} />
              </button>
              <button
                disabled={busy || !p}
                className="icon-button"
                aria-label={
                  (p?.status === 'paused' ? '恢复' : '暂停') + phase.label
                }
                onClick={() =>
                  void action(async () => {
                    await api.request(
                      'POST',
                      '/schedules/' +
                        phase.id +
                        (p?.status === 'paused' ? '/unpause' : '/pause'),
                    );
                    setRev((r) => r + 1);
                  })
                }
              >
                <Pause size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
