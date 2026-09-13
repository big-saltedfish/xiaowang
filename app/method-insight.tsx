'use client';
import { methodLesson, methodStatus } from '@/lib/loop-status';

export function MethodInsight({ policy, onRecords }: { policy: Record<string, unknown> | null; onRecords: () => void }) {
  const previous = policy?.previous as Record<string, unknown> | undefined;
  const rules = policy?.policy as Record<string, unknown> | undefined;
  const oldRules = previous?.policy as Record<string, unknown> | undefined;
  const changedDates = rules?.require_dates === true && oldRules?.require_dates === false;
  const reason = typeof policy?.reason === 'string' ? policy.reason : '还没有可读取的评测说明。';
  return <section className="method-insight">
    <p className="eyebrow">这次学到了什么</p><h2>{methodLesson(policy)}</h2>
    <p className="insight-status">{methodStatus(policy)}</p>
    <div className="insight-steps">
      <article><small>发现</small><h3>{changedDates ? '有些资料缺少明确日期' : '从研究中保留问题'}</h3><p>{changedDates ? '缺少日期的信息，需要进一步核实，不能直接当作已确认事实。' : '复盘会记录来源缺口、未解决问题和处理经验。'}</p></article>
      <article><small>改法</small><h3>{changedDates ? '先放进待核实区' : '查看本轮处理规则'}</h3><p>{methodLesson(policy)}</p></article>
      <article><small>下一步</small><h3>{policy?.status === 'trial' ? '让下一轮实际检验' : '继续检查新证据'}</h3><p>新规则通过本轮检查，不等于已经在后续研究中证明有效。有问题仍需回退。</p></article>
    </div>
    <details className="insight-details"><summary>查看评测说明和版本</summary><p>{reason}</p>{typeof policy?.version === 'number' && <p>方法版本：{policy.version}</p>}<button className="text-action" onClick={onRecords}>打开原始记忆记录 →</button></details>
  </section>;
}
