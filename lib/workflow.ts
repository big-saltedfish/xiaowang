import {
  QcaClient,
  type Identity,
  type Entity,
  type Model,
  type Schedule,
  type Target,
  type Mount,
  type Memory,
  type Channel,
  type QrSession,
  type Run,
} from './qca.ts';
export const APP_ID = 'watchtower-v1';
export const IFIND_SERVICES = [
  {
    name: 'hexin-ifind-ds-stock-mcp',
    label: 'A 股数据',
    tools: [
      'get_stock_summary',
      'get_stock_info',
      'get_stock_financials',
      'get_stock_performance',
      'get_stock_shareholders',
    ],
  },
  {
    name: 'hexin-ifind-ds-news-mcp',
    label: '新闻公告',
    tools: ['search_news', 'search_notice'],
  },
  {
    name: 'hexin-ifind-ds-index-mcp',
    label: '指数板块',
    tools: ['index_data', 'sector_data'],
  },
].map((s) => ({
  ...s,
  url: 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/' + s.name,
}));
export interface Preferences {
  watchlist: string;
  time: string;
  frequency: 'daily' | 'weekdays';
}
export interface Resources {
  identity: string;
  environment: string;
  vault: string;
  template: string;
  schedule: string;
  store: string;
  channel?: string;
  skill?: string;
  loopSkill?: string;
  reviewTemplate?: string;
  reviewStore?: string;
  reviewSchedule?: string;
  deliverySchedule?: string;
  voiceTemplate?: string;
  voiceStore?: string;
}
export interface Workspace {
  identity: Identity;
  resources: Partial<Resources>;
  preferences: Preferences;
}
export const DEFAULT_PREFERENCES: Preferences = {
  watchlist: '600519 贵州茅台，300750 宁德时代',
  time: '15:30',
  frequency: 'weekdays',
};
export function parsePreferences(input: Preferences): Preferences {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))
    throw new Error('请输入有效的执行时间。');
  const watchlist = input.watchlist.trim();
  if (!watchlist || watchlist.length > 500)
    throw new Error('关注清单必填，且不超过 500 字。');
  if (!['daily', 'weekdays'].includes(input.frequency))
    throw new Error('请选择每日或工作日。');
  return { watchlist, time: input.time, frequency: input.frequency };
}
export const RESEARCH_SYSTEM = `你是“守望”，为一个用户在云端持续进行 A 股研究。你执行实际工作并保存证据，不输出虚构的完成状态。
遵循 watchtower-research Skill。每轮先用 date 确认 Asia/Shanghai 当前日期和时间，再读取默认记忆库中 profile/preferences.md、research/rules.md、research/open-questions.md、research/lessons.md。只通过平台记忆工具写入长期记忆，不认为临时文件就已持久保存。
本轮任务明确提供的关注清单是当前研究范围，优先于记忆中的旧清单；其他阅读与风险偏好从长期记忆读取。用户设置不得自行更改。不要索要每天重复提问。
依次执行：1. 读取记忆与上次档案；2. 用同花顺 MCP 查真实数据；3. 核对日期、来源、统计口径并去重；4. 写完整报告与结构化伴随数据；5. DeliverArtifacts 交付，再用 add_drive_file 显式保存至 Drive；6. 记录本轮复盘与方法候选；7. 返回适合 IM 的简短摘要。
同花顺工具：A股财务get_stock_financials、行情get_stock_performance，新闻search_news、公告search_notice，指数index_data。日期用绝对日期。控制一次请求不超过5个主体/指标，不并行突发请求；本轮数据查询预算最多12次。工具失败如实列出缺失，不用模型知识补造数值。
资讯结果可能是公司资料页面或历史内容，不能视为新事件。区分事实、第三方观点、待核实；公告片段不是全文，没有URL时注明标题和日期及溯源缺口。财务区分累计和单季度；价格和指数都写数据日期、单位与市场。不开仓、不交易、不保证收益。
完整报告保存到 reports/YYYY/MM/DD/research-TIMESTAMP.md，伴随JSON同名。JSON包含 schema_version=1、title、date、summary、sources(数组，每项title,url或null,published_at,kind)、open_questions(字符串数组)、method_changes(数组，每项before,after,reason,status为candidate或validated,evidence)。使用唯一时间戳避免覆盖旧稿。遵照 Skill 的固定校验器检查 JSON；校验未通过不宣称报告验证完成。
DeliverArtifacts和Drive保存都成功后才能说“已归档”；保留工具返回的路径。报告主流程不依赖浏览器。若保存失败，说明未归档并保留错误；不得用成功措辞掩盖。
复盘：把本轮遇到的过时数据、重复来源、口径歧义写入 research/lessons.md，附报告路径。新的方法先作为候选；只有能通过固定检查验证的来源格式、日期保留、去重规则才可标记validated并用于后续轮次。不要把自我评价当效果证明，不改模板权限或凭据，不创建更多Schedule，不增加任务预算。偏好变更仅接受用户明确指示。用平台记忆工具保存更新，并明确指出没有完成的写入。
每轮最终返回：研究日期、3条以内变化、最多2个待核实问题、Drive路径、这轮方法变化(或无变化)。资料不足时发简洁的数据缺失说明。非交易日仍可处理公告与新闻，明确没有新行情。`;
export function researchTemplate(r: {
  environment: string;
  vault: string;
  skill?: string;
  model: string;
}) {
  return {
    name: '守望 · 个人研究 v1',
    description: '云端定期研究、Drive归档和可追溯记忆复盘',
    model: r.model,
    environment_id: r.environment,
    system: RESEARCH_SYSTEM,
    tools: [
      {
        type: 'agent_toolset_20260401',
        enabled_tools: [
          'Read',
          'Write',
          'Edit',
          'Bash',
          'Glob',
          'Grep',
          'DeliverArtifacts',
        ],
        configs: [
          'Read',
          'Write',
          'Edit',
          'Bash',
          'Glob',
          'Grep',
          'DeliverArtifacts',
        ].map((name) => ({
          name,
          permission_policy: { type: 'always_allow' },
        })),
      },
      ...IFIND_SERVICES.map((s) => ({
        type: 'mcp_toolset',
        mcp_server_name: s.name,
        configs: s.tools.map((name) => ({
          name,
          enabled: true,
          permission_policy: { type: 'always_allow' },
        })),
      })),
    ],
    managed_tool_config: { enabled_tools: ['drive'] },
    mcp_servers: IFIND_SERVICES.map((s) => ({
      name: s.name,
      type: 'http',
      url: s.url,
    })),
    vaults: { [r.vault]: { enabled: true } },
    skills: r.skill
      ? [{ type: 'custom', skill_id: r.skill, enabled: true }]
      : [],
    metadata: { app: APP_ID },
  };
}
export function scheduleInput(
  r: { identity: string; template: string; environment: string },
  p: Preferences,
  delivery?: { channel: string; target?: Target },
  active = true,
) {
  const preferences = parsePreferences(p);
  const [hour, minute] = preferences.time.split(':').map(Number);
  return {
    identity_id: r.identity,
    template_id: r.template,
    environment_id: r.environment,
    name: '守望 · 每日研究',
    initial_events: [
      {
        type: 'user.message',
        content: `执行今日研究与复盘。用户关注：${preferences.watchlist}。先读取长期记忆，使用真实同花顺数据；保存报告到Drive，并记录方法候选与依据。主流程完成后返回简洁摘要。`,
      },
    ],
    trigger_policy: active
      ? {
          type: 'cron',
          expression: `${minute} ${hour} * * ${preferences.frequency === 'weekdays' ? '1-5' : '*'}`,
          timezone: 'Asia/Shanghai',
        }
      : { type: 'manual' },
    execution: {
      session_mode: 'new_session',
      max_concurrent_runs: 1,
      max_attempts: 1,
      timeout_ms: 900000,
    },
    sinks: delivery
      ? [
          {
            type: 'im_channel',
            channel_id: delivery.channel,
            target: delivery.target,
          },
        ]
      : [],
    metadata: { app: APP_ID, wt_preferences: JSON.stringify(preferences) },
  };
}
const checkpointKeys = [
  'environment',
  'vault',
  'template',
  'schedule',
  'store',
  'channel',
  'skill',
  'loopSkill',
  'reviewTemplate',
  'reviewStore',
  'reviewSchedule',
  'deliverySchedule',
  'voiceTemplate',
  'voiceStore',
] as const;
export function workspaceFrom(identity: Identity): Workspace {
  const m = identity.metadata ?? {};
  const resources: Partial<Resources> = { identity: identity.id };
  for (const key of checkpointKeys)
    if (m['wt_' + key]) resources[key] = m['wt_' + key];
  let preferences = DEFAULT_PREFERENCES;
  try {
    if (m.wt_preferences)
      preferences = parsePreferences(JSON.parse(m.wt_preferences));
  } catch {
    throw new Error('云端保存的研究配置格式异常，请检查 Identity metadata。');
  }
  return { identity, resources, preferences };
}
export async function restoreWorkspace(
  api: QcaClient,
): Promise<Workspace | null> {
  const identities = await api.list<Identity>('/identities', {
    external_id: APP_ID,
  });
  const identity = identities.find((i) => i.external_id === APP_ID);
  if (!identity) return null;
  if (!identity.enabled)
    throw new Error('研究身份已被停用，请先在 QCA 中启用。');
  const ws = workspaceFrom(identity);
  if (!ws.resources.schedule) return ws;
  const schedule = await api.request<Schedule>(
    'GET',
    `/schedules/${ws.resources.schedule}`,
  );
  const result = workspaceWithSchedule(ws, schedule);
  if (ws.resources.deliverySchedule) {
    const delivery = await api.request<Schedule>(
      'GET',
      '/schedules/' + ws.resources.deliverySchedule,
    );
    const sink = delivery.sinks?.find((s) => s.type === 'im_channel');
    result.identity.metadata.wt_im_enabled = String(Boolean(sink));
    result.identity.metadata.wt_target = sink
      ? JSON.stringify(sink.target)
      : '';
  }
  return result;
}
export function workspaceWithSchedule(
  ws: Workspace,
  schedule: Schedule,
): Workspace {
  const preferences = schedule.metadata?.wt_preferences
    ? parsePreferences(JSON.parse(schedule.metadata.wt_preferences))
    : ws.preferences;
  const sink = schedule.sinks?.find((s) => s.type === 'im_channel');
  return {
    ...ws,
    preferences,
    identity: {
      ...ws.identity,
      metadata: {
        ...ws.identity.metadata,
        wt_im_enabled: String(Boolean(sink)),
        wt_target: sink?.target ? JSON.stringify(sink.target) : '',
      },
    },
  };
}
export async function bootstrap(
  api: QcaClient,
  ifindKey: string,
  skillZip: Blob,
  onProgress: (s: string) => void,
): Promise<Workspace> {
  let ws = await restoreWorkspace(api);
  if (!ws) {
    onProgress('建立专属研究身份');
    const identity = await api.request<Identity>(
      'POST',
      '/identities',
      {
        external_id: APP_ID,
        name: '守望 · 我的研究站',
        metadata: { app: APP_ID },
      },
      {},
      APP_ID + '-identity',
    );
    ws = workspaceFrom(identity);
  }
  const identityId = ws.identity.id;
  const r = ws.resources;
  const checkpoint = async (key: string, value: string) => {
    const identity = await api.request<Identity>(
      'POST',
      `/identities/${identityId}`,
      { metadata: { ['wt_' + key]: value } },
    );
    ws = workspaceFrom(identity);
    Object.assign(r, ws.resources);
  };
  const ensure = async (
    key: (typeof checkpointKeys)[number],
    path: string,
    body: unknown,
  ) => {
    if (r[key]) return r[key]!;
    const entity = await api.request<Entity>(
      'POST',
      path,
      body,
      {},
      APP_ID + '-' + identityId + '-' + key,
    );
    if (!entity.id) throw new Error('创建资源未返回 ID');
    await checkpoint(key, entity.id);
    return entity.id;
  };
  onProgress('准备托管云环境');
  await ensure('environment', '/environments', {
    name: '守望研究环境',
    config: { type: 'cloud' },
    metadata: { app: APP_ID },
  });
  onProgress('准备凭证保险箱');
  await ensure('vault', '/vaults', {
    display_name: '守望同花顺凭证',
    metadata: { app: APP_ID },
  });
  await configureIfind(api, r.vault!, identityId, ifindKey, onProgress);
  if (!r.skill) {
    onProgress('上传固定研究工作流与校验器');
    const skill = await api.uploadSkill(
      skillZip,
      APP_ID + '-' + identityId + '-skill-v1',
    );
    await checkpoint('skill', skill.id);
  }
  if (!r.template) {
    onProgress('建立研究助手模板');
    const models = await api.request<{ data: Model[] }>('GET', '/models');
    const model =
      ws.identity.metadata?.wt_model ||
      models.data.find((m) => m.id === 'ultimate')?.id ||
      models.data.find((m) => m.is_enabled !== false)?.id;
    if (!model) throw new Error('此账号没有可用模型。');
    if (!ws.identity.metadata?.wt_model) await checkpoint('model', model);
    await ensure(
      'template',
      '/templates',
      researchTemplate({
        environment: r.environment!,
        vault: r.vault!,
        skill: r.skill,
        model,
      }),
    );
  }
  if (!r.store) {
    onProgress('初始化长期记忆');
    const session = await api.request<Entity>(
      'POST',
      '/sessions',
      {
        identity_id: identityId,
        template_id: r.template,
        title: '守望 · 初始化记忆',
      },
      {},
      APP_ID + '-' + identityId + '-memory-session',
    );
    if (!session.id) throw new Error('初始化会话失败');
    const response = await api.request<{ data: Mount[] }>(
      'GET',
      `/identities/${identityId}/templates/${r.template}/memory_stores`,
    );
    const store = response.data.find(
      (m) => m.system_managed && m.access === 'read_write',
    );
    if (!store) throw new Error('QCA 未提供默认可写记忆库，无法保证跨轮记忆。');
    await checkpoint('store', store.memory_store_id);
  }
  const memories = await api.list<Memory>(`/memory_stores/${r.store}/memories`);
  const seeds = [
    [
      'profile/preferences.md',
      `# 用户偏好\n关注：${ws.preferences.watchlist}\n先写变化，后写待核实问题。微信摘要一分钟可读，完整证据存Drive。未经用户指示不得改变关注范围。`,
    ],
    [
      'research/rules.md',
      '# 研究规则 v1\n必须标注数据日期与来源。新闻与资料页分开，转载按原始事件去重。区分事实、观点、待核实。不要用模型知识补造行情。',
    ],
    ['research/open-questions.md', '# 待核实问题\n首次启动，暂无历史问题。'],
    [
      'research/lessons.md',
      '# 研究经验\n暂无。每次方法修订必须附原因、证据和验证状态。',
    ],
  ];
  for (const [path, content] of seeds)
    if (!memories.some((m) => m.path === path))
      await api.request('POST', `/memory_stores/${r.store}/memories`, {
        path,
        content,
      });
  onProgress('准备手动验收计划');
  await ensure(
    'schedule',
    '/schedules',
    scheduleInput(
      {
        identity: identityId,
        template: r.template!,
        environment: r.environment!,
      },
      ws.preferences,
      undefined,
      false,
    ),
  );
  const refreshed = await restoreWorkspace(api);
  if (!refreshed) throw new Error('无法从QCA恢复刚创建的研究站。');
  return refreshed;
}
export async function configureIfind(
  api: QcaClient,
  vault: string,
  identity: string,
  key: string,
  onProgress: (s: string) => void = () => {},
) {
  const credentials = await api.list<
    Entity & { auth?: { mcp_server_url?: string } }
  >(`/vaults/${vault}/credentials`);
  for (const service of IFIND_SERVICES) {
    const existing = credentials.find(
      (c) => c.auth?.mcp_server_url === service.url,
    );
    if (existing && !key.trim()) continue;
    if (!key.trim())
      throw new Error(
        '首次配置需输入同花顺 MCP Key；已有云端资源已保存，下次可继续。',
      );
    onProgress((existing ? '更新' : '配置') + service.label + '凭证');
    if (existing) {
      await api.request('POST', `/vaults/${vault}/credentials/${existing.id}`, {
        auth: { type: 'static_bearer', token: key.trim() },
      });
    } else {
      await api.request(
        'POST',
        `/vaults/${vault}/credentials`,
        {
          auth: {
            type: 'static_bearer',
            mcp_server_url: service.url,
            token: key.trim(),
          },
          metadata: { app: APP_ID },
        },
        {},
        APP_ID + '-' + identity + '-' + service.name,
      );
    }
  }
}
export async function savePreferences(
  api: QcaClient,
  ws: Workspace,
  p: Preferences,
  delivery?: { channel: string; target?: Target },
  active = true,
): Promise<Workspace> {
  const r = ws.resources;
  if (!r.schedule || !r.template || !r.environment)
    throw new Error('初始化未完成。');
  const update: Partial<ReturnType<typeof scheduleInput>> = scheduleInput(
    {
      identity: ws.identity.id,
      template: r.template,
      environment: r.environment,
    },
    p,
    delivery,
    active,
  );
  delete update.identity_id;
  // Schedule configuration and its UI preferences commit in one cloud update.
  // Long-term freeform preferences belong to the user and are never replaced here.
  if (!delivery) delete update.sinks;
  const schedule = await api.request<Schedule>(
    'POST',
    `/schedules/${r.schedule}`,
    update,
  );
  return workspaceWithSchedule(ws, schedule);
}
export async function saveDelivery(
  api: QcaClient,
  ws: Workspace,
  delivery: { channel: string; target?: Target },
): Promise<Workspace> {
  if (!ws.resources.schedule) throw new Error('初始化未完成。');
  const schedule = await api.request<Schedule>(
    'POST',
    `/schedules/${ws.resources.deliverySchedule || ws.resources.schedule}`,
    {
      sinks: [
        {
          type: 'im_channel',
          channel_id: delivery.channel,
          target: delivery.target,
        },
      ],
    },
  );
  const sink = schedule.sinks?.find((s) => s.type === 'im_channel');
  if (ws.resources.deliverySchedule && sink) {
    await api.request('POST', `/schedules/${ws.resources.schedule}`, { sinks: [sink] });
  }
  return {
    ...ws,
    identity: {
      ...ws.identity,
      metadata: {
        ...ws.identity.metadata,
        wt_im_enabled: String(Boolean(sink)),
        wt_target: sink?.target ? JSON.stringify(sink.target) : '',
      },
    },
  };
}
export function runNeedsRefresh(run: Run): boolean {
  return (
    ['pending', 'running'].includes(run.status) || run.push_status === 'pending'
  );
}
export async function ensureWechat(
  api: QcaClient,
  ws: Workspace,
): Promise<Channel> {
  const r = ws.resources;
  if (!r.template) throw new Error('请先完成研究站初始化。');
  if (r.channel) return api.request<Channel>('GET', `/channels/${r.channel}`);
  const channel = await api.request<Channel>(
    'POST',
    '/channels',
    {
      channel_type: 'wechat',
      name: '守望 · 我的微信',
      identity_id: ws.identity.id,
      template_id: r.template,
      identity_resolution: { mode: 'fixed' },
      enabled: true,
    },
    {},
    APP_ID + '-' + ws.identity.id + '-wechat',
  );
  await api.request('POST', `/identities/${ws.identity.id}`, {
    metadata: { wt_channel: channel.id },
  });
  return channel;
}
export const createQr = (api: QcaClient, channelId: string) =>
  api.request<QrSession>('POST', `/channels/${channelId}/qr_sessions`, {});
export const runNow = (api: QcaClient, scheduleId: string, key: string) =>
  api.request<Run>('POST', `/schedules/${scheduleId}/run`, undefined, {}, key);
export const getSchedule = (api: QcaClient, id: string) =>
  api.request<Schedule>('GET', `/schedules/${id}`);
