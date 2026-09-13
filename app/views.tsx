'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  FileText,
  Folder,
  History,
  Info,
  KeyRound,
  Link2,
  LockKeyhole,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const reports = [
  {
    day: '10',
    weekday: '周四',
    title: '把新闻读薄，把值得跟进的事留下',
    subtitle: '收盘简报 · 关注清单',
    summary:
      '整理 8 条资料，合并 3 条重复信息。今天保留两个待核实问题，避免把同一事件的多次转载当成多个信号。',
    focus:
      '今天的重点，是区分“发生了什么”和“市场如何解读”。样例公司星河能源的一项进展被多次转载，本轮追溯到同一份原始公告，将它们合并为一件事。',
    question: '后续公告是否披露实际交付时间？新增信息是否改变先前判断的依据？',
    method: '先追溯原始来源，再按事件去重；同源转载不计为独立证据。',
    revision: '04',
    size: '6.2 KB',
    sources: '8',
    time: '15:34',
    type: '收盘简报',
  },
  {
    day: '09',
    weekday: '周三',
    title: '三篇报道，原来指向同一件事',
    subtitle: '收盘简报 · 信息去重',
    summary:
      '复核昨日资料后，发现三篇报道引用同一来源。记录去重问题，并为下一轮研究提出方法修订。',
    focus:
      '阅读量增加不一定意味着信息增加。样例中三个不同标题均转述同一项公开信息，应该合并展示，并保留原始出处。',
    question: '下一轮能否自动归并这类转载？去重后是否仍保留必要的不同观点？',
    method: '提出候选改进：按原始事件与公告链接聚合。将在下一轮样例中使用。',
    revision: '03',
    size: '5.1 KB',
    sources: '7',
    time: '15:35',
    type: '收盘简报',
  },
  {
    day: '08',
    weekday: '周二',
    title: '先看公告，再看市场的解读',
    subtitle: '收盘简报 · 来源核验',
    summary:
      '将公司披露、媒体解读和待验证信息分开呈现，降低阅读时混淆事实与观点的可能。',
    focus:
      '样例公司云杉消费的媒体评论包含对未来的判断，本轮将其单列为观点，避免与已经披露的经营事实混在一起。',
    question: '哪些结论已有公告支持？哪些还需要后续数据验证？',
    method: '每条信息标注“已披露事实”“第三方观点”或“待核实”。',
    revision: '02',
    size: '4.8 KB',
    sources: '6',
    time: '15:33',
    type: '收盘简报',
  },
  {
    day: '07',
    weekday: '周一',
    title: '新的一周，从两个问题开始',
    subtitle: '收盘简报 · 待办接续',
    summary:
      '从长期记忆读取上周未解决的问题，继续追踪，不重复生成已经确认过的结论。',
    focus:
      '本轮先读已有记录，再查新增信息。仍无新增证据的问题保留为待核实，没有用重复新闻填补空白。',
    question: '新的资料是否真正补充证据？旧问题应继续跟进还是归档？',
    method: '每次启动先读取 open-questions，记录本次核实结果与下次复查条件。',
    revision: '02',
    size: '4.3 KB',
    sources: '5',
    time: '15:34',
    type: '收盘简报',
  },
  {
    day: '04',
    weekday: '周五',
    title: '一周研究回顾：留下一条更好的规则',
    subtitle: '复盘记录 · 方法沉淀',
    summary:
      '回顾一周的简报样例，把“为数据标注时间”加入研究规则，过期数据不再写成当日表现。',
    focus:
      '复盘的重点是研究过程：有没有标明数据时间，来源是否能追溯，尚未证实的判断是否被误写成事实。',
    question: '下周报告是否稳定保留数据时间？用户是否仍需要手动追问来源？',
    method: '所有行情引用必须附数据时点，缺失时明确说明。',
    revision: '01',
    size: '3.8 KB',
    sources: '4',
    time: '17:05',
    type: '方法复盘',
  },
];
const memories = [
  {
    icon: ShieldCheck,
    category: '研究方法',
    name: '同源资讯去重',
    path: 'research/source-rules.md',
    status: '已用于示例报告',
    revision: '04',
    before: '按相关度选取三条新闻，分别摘要。',
    after:
      '先定位原始公告与事件。同源转载合并展示，不作为独立证据；保留存在差异的观点。',
    reason:
      '昨日的三条新闻引用同一份原始公告。用户反馈：“重复信息有点多，告诉我真正新发生的事就行。”',
    evidence: '09.09 简报 · 用户反馈记录',
    applied: '09.10 简报合并 3 条重复信息，并保留原始来源。',
    kind: '可写记忆 · 方法记录',
  },
  {
    icon: Clock3,
    category: '研究方法',
    name: '数据必须带时间',
    path: 'research/freshness.md',
    status: '已用于示例报告',
    revision: '02',
    before: '展示查询到的最新价格。',
    after:
      '价格、经营数据均注明数据时点。明确区分当日、延迟与历史数据；缺失时不补写数值。',
    reason:
      '复盘时发现一份资料的发布时间晚于数据所属日期，容易让读者误认为是当日信息。',
    evidence: '09.04 方法复盘 · 新鲜度检查',
    applied: '后续示例均保留来源时间；本原型不展示真实行情。',
    kind: '可写记忆 · 方法记录',
  },
  {
    icon: BookOpen,
    category: '个人偏好',
    name: '一分钟读完，先讲变化',
    path: 'profile/preferences.md',
    status: '用户已设定',
    revision: '01',
    before: '使用默认摘要格式。',
    after:
      '先列本次新增信息，再列待核实问题。微信摘要控制在一分钟阅读量，完整证据保存在报告中。',
    reason: '用户明确设定阅读偏好：“下班路上看，少一点套话，多一点变化。”',
    evidence: '初始偏好设置',
    applied: '每轮先读取此偏好，不由助理自行调整关注范围。',
    kind: '可写记忆 · 用户偏好',
  },
  {
    icon: Brain,
    category: '待核实问题',
    name: '保留问题，不猜答案',
    path: 'research/open-questions.md',
    status: '等待新证据',
    revision: '03',
    before: '每次任务从当前问题开始。',
    after:
      '保留上一轮未解决的问题，附来源与复查条件。新证据不足时继续标注待核实，不生成确定性结论。',
    reason: '跨会话执行仍需知道哪些事情没有查清，避免每天重复开始。',
    evidence: '09.07 研究记录',
    applied: '下一次计划执行时读取；是否解决由新增证据决定。',
    kind: '可写记忆 · 待办接续',
  },
];
function Badge({
  children,
  warm = false,
}: {
  children: React.ReactNode;
  warm?: boolean;
}) {
  return <span className={`tag ${warm ? 'warm' : ''}`}>{children}</span>;
}
function ViewHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="view-heading">
      <p className="eyebrow">{label}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function ReportsView() {
  const [selected, setSelected] = useState(0);
  const [category, setCategory] = useState('全部');
  const report = reports[selected];
  return (
    <>
      <ViewHeading
        label="YOUR RESEARCH ARCHIVE"
        title="会话结束，成果留下。"
        description="每天的研究报告，按日期保存在你的 Drive。随时翻阅，继续跟进。"
      />
      <div className="archive-toolbar">
        <div>
          <Folder size={17} />
          <span>Drive</span>
          <ChevronRight size={13} />
          <span>reports</span>
          <ChevronRight size={13} />
          <strong>2026 / 09</strong>
        </div>
        <span className="secondary">5 份示例档案 · 本地预览</span>
      </div>
      <div className="archive-layout">
        <aside className="archive-list">
          <div className="filter-tabs" aria-label="报告分类">
            {['全部', '收盘简报', '方法复盘'].map((type) => (
              <button
                key={type}
                aria-pressed={category === type}
                className={category === type ? 'active' : ''}
                onClick={() => {
                  setCategory(type);
                  const first = reports.findIndex(
                    (r) => type === '全部' || r.type === type,
                  );
                  setSelected(first);
                }}
              >
                {type}
              </button>
            ))}
          </div>
          {reports.map(
            (r, i) =>
              (category === '全部' || category === r.type) && (
                <button
                  key={r.day}
                  className={`archive-item ${selected === i ? 'active' : ''}`}
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  <div className="archive-item-top">
                    <span>
                      09.{r.day} <small>{r.weekday}</small>
                    </span>
                    <FileText size={16} />
                  </div>
                  <strong>{r.title}</strong>
                  <div className="archive-item-meta">
                    <span>{r.type}</span>
                    <span>{r.size}</span>
                  </div>
                </button>
              ),
          )}
          <div className="archive-hint">
            <FolderOpenIcon />
            <p>
              按日期归档
              <br />
              <span>新会话也可以继续读取</span>
            </p>
          </div>
        </aside>
        <article className="report-reader" aria-live="polite">
          <div className="reader-top">
            <Badge>{report.type}</Badge>
            <span>
              2026.09.{report.day} · {report.time}
            </span>
            <span className="sample-label">虚构研究样例</span>
          </div>
          <h2>{report.title}</h2>
          <p className="reader-lead">{report.summary}</p>
          <div className="reader-metrics">
            <div>
              <b>{report.sources}</b>
              <span>条样例资料</span>
            </div>
            <div>
              <b>02</b>
              <span>个待核实问题</span>
            </div>
            <div>
              <b>#{report.revision}</b>
              <span>研究规则修订</span>
            </div>
          </div>
          <h3>
            <span>01</span>值得留意的变化
          </h3>
          <p>{report.focus}</p>
          <div className="fact-box">
            <ShieldCheck size={19} />
            <div>
              <strong>先有证据，再有判断</strong>
              <p>
                星河能源、云杉消费及相关事件均为虚构演示内容。此处展示报告结构，不提供真实市场结论。
              </p>
            </div>
          </div>
          <h3>
            <span>02</span>下一次继续核实
          </h3>
          <p>{report.question}</p>
          <h3>
            <span>03</span>这次沿用的研究方法
          </h3>
          <p>{report.method}</p>
          <div className="source-box">
            <div>
              <Link2 size={16} />
              <strong>资料与来源</strong>
              <span>演示占位</span>
            </div>
            <p>样例公告 A · 原始披露 / 样例新闻 B · 第三方解读</p>
            <p>正式报告保留原文链接、发布时间与抓取时间，支持回溯。</p>
          </div>
          <div className="reader-file">
            <FileText size={16} />
            <code>
              reports/2026/09/{report.day}/
              {report.type === '方法复盘' ? 'review' : 'close-brief'}-r1.md
            </code>
          </div>
        </article>
      </div>
    </>
  );
}
function FolderOpenIcon() {
  return <Folder size={20} />;
}
export function MemoryView({ openReport }: { openReport: () => void }) {
  const [selected, setSelected] = useState(0);
  const memory = memories[selected];
  return (
    <>
      <ViewHeading
        label="MEMORY & CONTINUOUS IMPROVEMENT"
        title="每次工作，多留下一点经验。"
        description="记住你的偏好，也记下方法为什么改变。每条修订，都能回看依据。"
      />
      <div className="memory-summary">
        <div>
          <Brain size={21} />
          <div>
            <strong>个人默认记忆库</strong>
            <span>同一身份与模板 · 跨会话复用</span>
          </div>
          <Badge>可写</Badge>
        </div>
        <div>
          <BookOpen size={21} />
          <div>
            <strong>研究守则</strong>
            <span>固定参考资料 · 挂载供助理读取</span>
          </div>
          <Badge>只读</Badge>
        </div>
        <div>
          <History size={21} />
          <div>
            <strong>修改自动留版本</strong>
            <span>展示修订记录，不代表模型训练</span>
          </div>
        </div>
      </div>
      <div className="memory-layout">
        <aside className="memory-list">
          <p className="list-label">
            记忆条目 <span>4 条示例</span>
          </p>
          {memories.map((m, i) => (
            <button
              className={`memory-item ${selected === i ? 'active' : ''}`}
              key={m.path}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <m.icon size={20} />
              <div>
                <small>{m.category}</small>
                <strong>{m.name}</strong>
                <span>{m.status}</span>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
        </aside>
        <article className="memory-detail" aria-live="polite">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">REVISION #{memory.revision} / 演示记录</p>
              <h2>{memory.name}</h2>
            </div>
            <Badge warm={selected === 3}>{memory.status}</Badge>
          </div>
          <p className="memory-path">
            {memory.path} <span>{memory.kind}</span>
          </p>
          <div className="change-grid">
            <section>
              <p>修订前</p>
              <h3>{memory.before}</h3>
            </section>
            <section>
              <p>
                <Sparkles size={14} />
                修订后
              </p>
              <h3>{memory.after}</h3>
            </section>
          </div>
          <div className="reason-block">
            <p className="eyebrow">WHY THIS CHANGED</p>
            <h3>这次为什么改？</h3>
            <p>{memory.reason}</p>
            <span>
              <Link2 size={14} />
              {memory.evidence}
            </span>
          </div>
          <div className="applied-block">
            <Check size={18} />
            <div>
              <strong>后续如何使用</strong>
              <p>{memory.applied}</p>
              {selected === 0 && (
                <Button variant="link" onClick={openReport}>
                  查看采用此规则的示例报告
                  <ArrowUpRight size={14} />
                </Button>
              )}
            </div>
          </div>
          <div className="revision-trail">
            <span>
              <i />
              发现问题
            </span>
            <ArrowRight size={13} />
            <span>
              <i />
              记录修订
            </span>
            <ArrowRight size={13} />
            <span>
              <i />
              后续应用
            </span>
            <ArrowRight size={13} />
            <span className="pending">继续验证</span>
          </div>
          <p className="detail-disclaimer">
            变更与证据关联由应用约定；正式效果需用固定样例验证。此处展示版本记录的呈现方式。
          </p>
        </article>
      </div>
    </>
  );
}
export function ChannelView({ openReport }: { openReport: () => void }) {
  return (
    <>
      <ViewHeading
        label="DELIVERED TO YOUR EVERYDAY"
        title="不用每天问，到了时间告诉你。"
        description="把简报送到熟悉的微信里。完整报告留在研究站，偶尔回来看看就好。"
      />
      <div className="channel-layout">
        <section className="panel channel-config">
          <div className="channel-title">
            <div className="wechat-icon">
              <MessageCircle size={27} />
            </div>
            <div>
              <h2>我的微信</h2>
              <p>个人通知渠道</p>
            </div>
            <Badge>绑定效果示意</Badge>
          </div>
          <div className="configuration-row">
            <span>执行身份</span>
            <strong>我的研究身份</strong>
          </div>
          <div className="configuration-row">
            <span>研究助手</span>
            <strong>守望 · 收盘研究</strong>
          </div>
          <div className="configuration-row">
            <span>投递位置</span>
            <strong>
              个人会话 <span className="secondary">示例</span>
            </strong>
          </div>
          <div className="configuration-row">
            <span>通知节奏</span>
            <strong>每个工作日 · 15:30 开始研究</strong>
          </div>
          <div className="binding-steps">
            <h3>接入时，完成这三步</h3>
            <div>
              <span>1</span>
              <p>
                <strong>扫码授权微信</strong>
                <small>获取二维码，确认授权后检查连接状态。</small>
              </p>
              <QrCode size={20} />
            </div>
            <div>
              <span>2</span>
              <p>
                <strong>确认通知目标</strong>
                <small>在目标会话发送 /target，填写返回的目标配置。</small>
              </p>
            </div>
            <div>
              <span>3</span>
              <p>
                <strong>验证一次投递</strong>
                <small>分别确认任务执行和微信投递状态。</small>
              </p>
            </div>
          </div>
          <Button variant="outline" className="disabled-action" disabled>
            <QrCode size={16} />
            绑定微信 · 尚未接入
          </Button>
          <p className="form-note">
            这是展示原型，不生成授权二维码，也不会发送消息。
          </p>
        </section>
        <section className="message-preview">
          <div className="message-preview-title">
            <MessageCircle size={17} />
            <span>你在微信里看到的样子</span>
            <span className="sample-label">消息样例</span>
          </div>
          <div className="phone-surface">
            <header>
              <span>‹</span>
              <strong>守望 · 研究助理</strong>
              <span>···</span>
            </header>
            <div className="message-time">9 月 10 日 15:34</div>
            <div className="chat-row">
              <div className="bot-avatar">
                <Cloud size={21} />
              </div>
              <div className="message-bubble">
                <p>
                  <strong>今天的功课整理好了 ☕</strong>
                </p>
                <p>关注清单里的两家公司，今天有两件事值得继续跟进。</p>
                <p>
                  ① 同一公告的三条转载已合并，避免重复阅读。
                  <br />② 一条市场观点暂缺原始证据，已标为待核实。
                </p>
                <p>
                  完整简报已存入
                  Drive。昨天你提到的「少一点重复」，这次也记住了。
                </p>
                <span className="message-footnote">
                  以上公司、事件与投递均为虚构示例。
                </span>
                <Button variant="link" onClick={openReport}>
                  在研究站打开示例报告
                  <ArrowUpRight size={14} />
                </Button>
              </div>
            </div>
            <div className="phone-bottom">
              <LockKeyhole size={14} />
              仅预览通知效果，无聊天或发送功能
            </div>
          </div>
          <div className="delivery-status">
            <div>
              <Check size={17} />
              <span>研究执行完成</span>
            </div>
            <div>
              <Check size={17} />
              <span>IM 投递成功</span>
            </div>
            <small>独立状态示例 · 投递成功不等于已读</small>
          </div>
        </section>
      </div>
    </>
  );
}
export function SettingsView() {
  return (
    <>
      <ViewHeading
        label="SET IT ONCE, LET IT WORK"
        title="交代一次，让工作按计划发生。"
        description="配置你的身份、研究范围与交付节奏。主循环由云端承担，网页只是控制面板。"
      />
      <div className="settings-layout">
        <section className="panel settings-main">
          <div className="settings-section">
            <div className="settings-section-title">
              <span>01</span>
              <h2>连接 QCA</h2>
              <Badge warm>未连接</Badge>
            </div>
            <label htmlFor="pat-demo">个人访问令牌 PAT</label>
            <div className="token-field">
              <KeyRound size={18} />
              <input
                id="pat-demo"
                type="password"
                disabled
                value="demo-not-a-real-token"
                readOnly
                autoComplete="off"
              />
            </div>
            <p className="form-note">
              静态展示，请勿输入真实令牌。正式接入拟仅在当前页面内存中使用 PAT。
            </p>
            <div className="settings-fields">
              <div>
                <p className="field-label">身份</p>
                <div className="value-box">我的管理员 Identity</div>
              </div>
              <div>
                <p className="field-label">运行环境</p>
                <div className="value-box">
                  <Cloud size={15} />
                  托管云环境
                </div>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">
              <span>02</span>
              <h2>定义研究工作</h2>
            </div>
            <p className="field-label">关注范围</p>
            <div className="value-box">
              <span className="selection-chip">消费观察</span>
              <span className="selection-chip">新能源</span>
              <span className="secondary">示例关注方向</span>
            </div>
            <p className="field-label">工作目标</p>
            <div className="value-box multiline">
              每个工作日收盘后，整理关注清单的新信息，核验来源、生成简报、保存报告，并记录值得沿用的研究经验。
            </div>
            <div className="integration-list">
              <div>
                <LayersIcon />
                <span>
                  <strong>同花顺 iFinD · A 股数据</strong>
                  <small>stock · 行情、财务、选股 · 本机已验证</small>
                </span>
                <Badge warm>云端待接入</Badge>
              </div>
              <div>
                <BookOpen size={18} />
                <span>
                  <strong>同花顺 iFinD · 新闻公告</strong>
                  <small>news · 新闻与公告片段检索 · 本机已验证</small>
                </span>
                <Badge warm>云端待接入</Badge>
              </div>
              <div>
                <FileText size={18} />
                <span>
                  <strong>同花顺 iFinD · 指数板块</strong>
                  <small>index · 大盘、行业与成分股 · 本机已验证</small>
                </span>
                <Badge warm>云端待接入</Badge>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>
                  <strong>研究方法 Skill</strong>
                  <small>核验来源、按事件去重、显式保存成果</small>
                </span>
                <Badge>配置示意</Badge>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <div className="settings-section-title">
              <span>03</span>
              <h2>设置交付节奏</h2>
            </div>
            <div className="settings-fields">
              <div>
                <p className="field-label">开始时间</p>
                <div className="value-box">
                  <Timer size={16} />
                  15:30 · Asia/Shanghai
                </div>
              </div>
              <div>
                <p className="field-label">执行频率</p>
                <div className="value-box">每个工作日</div>
              </div>
            </div>
            <p className="form-note">
              非交易日由任务核验后说明或跳过研究。工作日计划不等同于交易日历。
            </p>
            <div className="configuration-row">
              <span>每轮执行</span>
              <strong>新 Session，接续记忆与档案</strong>
            </div>
            <div className="configuration-row">
              <span>完成后</span>
              <strong>存入 Drive，并向微信投递摘要</strong>
            </div>
            <Button className="solid-button disabled-action" disabled>
              启用云端计划 · 尚未接入
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        <aside className="settings-aside">
          <section className="connection-note">
            <Cloud size={28} />
            <h2>
              关掉网页，
              <br />
              计划仍在云端。
            </h2>
            <p>
              浏览器负责配置与查看。Schedule 触发执行，记忆库和 Drive
              保存连续性，结果通过 IM 送达。
            </p>
            <ul>
              <li>
                <Check size={15} />
                无需本地定时器
              </li>
              <li>
                <Check size={15} />
                无需浏览器代执行工具
              </li>
              <li>
                <Check size={15} />
                重新打开可读取历史
              </li>
            </ul>
          </section>
          <section className="technical-note">
            <Info size={20} />
            <h3>纯前端直连需先验证</h3>
            <p>
              本次无凭证跨域预检返回
              401，尚未证实任意静态站可直连。正式接入需确认 API
              与文件存储的跨域策略。
            </p>
            <a href="/research.md" target="_blank" rel="noreferrer">
              阅读完整 API 研究
              <ArrowUpRight size={14} />
            </a>
          </section>
          <section className="technical-note">
            <History size={20} />
            <h3>“进化”的具体含义</h3>
            <p>
              积累记忆、修订研究方法、留下版本与证据。效果需另行验证，不能把修订次数当作能力提升。
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
function LayersIcon() {
  return <FileText size={18} />;
}
