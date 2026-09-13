import { QcaClient, QcaError } from './qca';
export interface ForwardContext {
  api: QcaClient;
}
export class ForwardApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function forwardRequest<T>(
  ctx: ForwardContext,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  try {
    return await ctx.api.request<T>(
      method,
      path,
      body,
      query as Record<string, string | number | undefined>,
      options.idempotencyKey,
    );
  } catch (e) {
    if (e instanceof QcaError)
      throw new ForwardApiError(e.status, e.message, e.code);
    throw e;
  }
}
