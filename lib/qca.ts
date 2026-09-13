export type Region = 'cn' | 'global';
export type Metadata = Record<string, string>;
export interface Identity {
  id: string;
  external_id: string;
  name: string;
  enabled: boolean;
  metadata: Metadata;
}
export interface Model {
  id: string;
  display_name?: string;
  is_enabled?: boolean;
}
export interface Entity {
  id: string;
  name?: string;
  status?: string;
  metadata?: Metadata;
}
export interface Template extends Entity {
  environment_id: string;
  model: string | { id: string };
  system?: string;
}
export interface Schedule extends Entity {
  identity_id: string;
  template_id: string;
  environment_id: string;
  trigger_policy: {
    type: string;
    expression?: string;
    timezone?: string;
    upcoming_runs_at?: string[];
  };
  execution?: { session_mode: string };
  sinks?: { type: string; channel_id: string; target?: Target }[];
}
export interface Run {
  id: string;
  schedule_id: string;
  session_id?: string;
  status: string;
  push_status?: string;
  result_payload?: string;
  triggered_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
}
export interface DriveEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  last_modified?: string;
}
export interface Memory extends Entity {
  path: string;
  content?: string;
  content_sha256?: string;
  updated_at?: string;
}
export interface MemoryVersion extends Entity {
  memory_id: string;
  content?: string | null;
  operation: string;
  created_at: string;
  redacted?: boolean;
}
export interface Mount {
  memory_store_id: string;
  system_managed: boolean;
  access: string;
}
export interface Channel extends Entity {
  channel_type: string;
  identity_id?: string;
  template_id?: string;
  enabled: boolean;
  binding_status: string;
}
export interface QrSession {
  session_key: string;
  status: string;
  qr_code_image_base64?: string;
  qr_code_content?: string;
  expires_at?: string;
}
export interface Event {
  id: string;
  type: string;
  content?: unknown;
  created_at?: string;
  stop_reason?: { type?: string };
  [key: string]: unknown;
}
export interface Target {
  type: 'user' | 'group';
  external_id: string;
}
const BASES: Record<Region, string> = {
  cn: '/api/qca/cn',
  global: '/api/qca/global',
};
export class QcaError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.name = 'QcaError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}
function messageFor(status: number): string {
  if (status === 401)
    return 'QCA 密钥无效、已过期，或服务区域不匹配。请检查后重新连接。';
  if (status === 403)
    return '当前账号没有此操作权限，请检查账号权益和资源归属。';
  if (status === 404)
    return 'QCA 中未找到此资源。请刷新状态，确认资源未被删除。';
  if (status === 409)
    return '资源状态冲突，或相同操作正在执行。请先刷新，不要重复创建。';
  if (status === 429) return '请求过于频繁，请稍后重试。';
  if (status >= 500)
    return 'QCA 服务暂时不可用。已有云端计划不会因页面报错而被取消。';
  return 'QCA 拒绝了请求，请检查配置与接口支持情况。';
}
export class QcaClient {
  readonly region: Region;
  #pat: string;
  #fetch: typeof fetch;
  constructor(region: Region, pat: string, fetcher: typeof fetch = fetch) {
    if (!BASES[region] || !pat.trim() || /[\r\n]/.test(pat))
      throw new Error('请选择服务区域并输入有效的 QCA Key。');
    this.region = region;
    this.#pat = pat.trim();
    this.#fetch = fetcher.bind(globalThis);
  }
  voiceCredentials() {
    return {
      pat: this.#pat,
      environment:
        this.region === 'cn' ? ('cn-prod' as const) : ('global-prod' as const),
    };
  }
  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
    query: Record<string, string | number | undefined> = {},
    idempotencyKey?: string,
  ): Promise<T> {
    if (
      !/^\/[a-z_]+(?:[/?]|$)/.test(path) ||
      path.includes('://') ||
      path.includes('..') ||
      path.includes('\\')
    )
      throw new Error('非法 API 路径');
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) search.set(key, String(value));
    const url =
      BASES[this.region] +
      path +
      (search.size ? '?' + search.toString().replace(/%2F/gi, '/') : '');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#pat}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError')
        throw new QcaError(
          0,
          'timeout',
          '请求超时。写操作可能已在云端完成，请重新读取状态后再试。',
        );
      throw new QcaError(
        0,
        'proxy_unavailable',
        '无法连接转发服务，请确认已启动守望服务并检查网络。',
      );
    }
    if (!response.ok) {
      let code = 'request_failed';
      try {
        const data = (await response.json()) as { error?: { code?: unknown } };
        const candidate = data?.error?.code;
        if (typeof candidate === 'string' && /^[\w.-]{1,80}$/.test(candidate))
          code = candidate;
      } catch {
        /* Not all gateway errors are JSON. */
      }
      throw new QcaError(
        response.status,
        code,
        messageFor(response.status),
        response.headers.get('x-request-id') ?? undefined,
      );
    }
    if (response.status === 204) return {} as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new QcaError(
        response.status,
        'invalid_response',
        'QCA 返回了无法识别的响应。',
      );
    }
  }
  async uploadSkill(blob: Blob, key: string): Promise<Entity> {
    const form = new FormData();
    form.append('files', blob, 'watchtower-research.zip');
    form.append('metadata', JSON.stringify({ app: 'watchtower-v1' }));
    let r: Response;
    try {
      r = await this.#fetch(BASES[this.region] + '/skills', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#pat}`,
          'Idempotency-Key': key,
        },
        body: form,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new QcaError(
        0,
        'proxy_unavailable',
        '研究技能上传失败，请检查转发服务和网络；已有资源会保留。',
      );
    }
    if (!r.ok)
      throw new QcaError(r.status, 'skill_upload_failed', messageFor(r.status));
    return (await r.json()) as Entity;
  }
  async list<T = Entity>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T[]> {
    const result: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const r = await this.request<{
        data: T[];
        has_more?: boolean;
        last_id?: string;
      }>('GET', path, undefined, { ...query, limit: 100, after_id: cursor });
      if (!Array.isArray(r.data))
        throw new QcaError(200, 'invalid_response', '列表响应缺少 data。');
      result.push(...r.data);
      if (!r.has_more) return result;
      if (!r.last_id || seen.has(r.last_id))
        throw new QcaError(
          200,
          'invalid_pagination',
          '分页游标没有推进，请重新加载。',
        );
      seen.add(r.last_id);
      cursor = r.last_id;
    }
    throw new QcaError(
      200,
      'page_limit',
      '记录过多，请缩小筛选范围后分页查看。',
    );
  }
  async driveEntries(identityId: string, path: string): Promise<DriveEntry[]> {
    const all: DriveEntry[] = [];
    const seen = new Set<string>();
    let token: string | undefined;
    for (let i = 0; i < 100; i++) {
      const r = await this.request<{
        entries: DriveEntry[];
        next_page_token?: string;
      }>('GET', '/drives/entries', undefined, {
        identity_id: identityId,
        path,
        limit: 100,
        page_token: token,
      });
      if (!Array.isArray(r.entries))
        throw new QcaError(200, 'invalid_response', 'Drive 响应缺少目录。');
      all.push(...r.entries);
      if (!r.next_page_token) return all;
      if (seen.has(r.next_page_token))
        throw new QcaError(
          200,
          'invalid_pagination',
          'Drive 分页游标没有推进。',
        );
      seen.add(r.next_page_token);
      token = r.next_page_token;
    }
    throw new QcaError(200, 'page_limit', '目录过大，请选择更具体的日期。');
  }
  async readDriveFile(identityId: string, path: string): Promise<string> {
    const query = new URLSearchParams({ identity_id: identityId, path });
    let response: Response;
    try {
      response = await this.#fetch(
        BASES[this.region] + '/_drive_preview?' + query,
        {
          headers: { Authorization: `Bearer ${this.#pat}` },
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(75000),
        },
      );
    } catch {
      throw new QcaError(
        0,
        'proxy_unavailable',
        '无法通过转发服务读取报告，请检查服务与网络。',
      );
    }
    if (!response.ok)
      throw new QcaError(
        response.status,
        'preview_failed',
        response.status === 413
          ? '文件超过 2 MB，暂不支持正文预览。'
          : '报告读取失败，请刷新重试；云端文件仍会保留。',
      );
    const text = await response.text();
    return text;
  }
}
export function eventText(e: Event): string {
  if (typeof e.content === 'string') return e.content;
  if (Array.isArray(e.content))
    return e.content
      .map((x) => (typeof x?.text === 'string' ? x.text : ''))
      .join('');
  return '';
}
export function parseTarget(raw: string): Target {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('请粘贴 /target 返回的 JSON，不要填写微信昵称。');
  }
  if (!obj || typeof obj !== 'object') throw new Error('通知目标格式不正确。');
  const candidate = ('target' in obj ? obj.target : obj) as Partial<Target>;
  if (
    !candidate ||
    !['user', 'group'].includes(candidate.type ?? '') ||
    typeof candidate.external_id !== 'string' ||
    !candidate.external_id.trim() ||
    candidate.external_id.length > 512
  )
    throw new Error('通知目标必须包含 type 和 external_id。');
  return {
    type: candidate.type as Target['type'],
    external_id: candidate.external_id.trim(),
  };
}
