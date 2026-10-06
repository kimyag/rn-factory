import { hashIp, issueSession, verifySession } from './identity.ts';
import { callProvider, type ProviderName } from './provider.ts';
import { actualMicroUsd, allowSession, reserveMicroUsd, reserveQuota, resetAt, settleQuota, type QuotaStore } from './quota.ts';
import { instructions, profileJsonSchema, profileSchema, requestSchema } from './schema.ts';

type ServerEnv = Record<string, string | undefined>;
type ServerConfig = {
  secret: string;
  store: QuotaStore;
  provider: ProviderName;
  apiKey: string;
  model: string;
  inputRate: number;
  outputRate: number;
  revenueCatKey: string | null;
};

const models = {
  'gpt-6-luna': { provider: 'openai', inputRate: 0.1, outputRate: 0.5 },
  'claude-haiku-4-5-20251001': { provider: 'anthropic', inputRate: 1, outputRate: 5 },
} as const;

function configured(value: string | undefined): value is string {
  return !!value && !value.includes('PLACEHOLDER');
}

function config(env: ServerEnv, fetcher: typeof fetch): ServerConfig | null {
  if (env.AI_MODULE_ENABLED !== 'true') return null;
  const provider = env.AI_PROVIDER === 'anthropic' ? 'anthropic' : env.AI_PROVIDER === 'openai' ? 'openai' : null;
  if (!provider) return null;
  const model = env.AI_MODEL ?? (provider === 'openai' ? 'gpt-6-luna' : 'claude-haiku-4-5-20251001');
  const rate = models[model as keyof typeof models];
  const apiKey = provider === 'openai' ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
  if (!rate || rate.provider !== provider || !configured(apiKey) || !configured(env.AI_SIGNING_KEY)
    || !configured(env.UPSTASH_REDIS_REST_URL) || !configured(env.UPSTASH_REDIS_REST_TOKEN)
    || !env.UPSTASH_REDIS_REST_URL.startsWith('https://')) return null;
  return {
    secret: env.AI_SIGNING_KEY,
    store: { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN, fetcher },
    provider, apiKey, model, inputRate: rate.inputRate, outputRate: rate.outputRate,
    revenueCatKey: configured(env.REVENUECAT_PUBLIC_API_KEY) ? env.REVENUECAT_PUBLIC_API_KEY : null,
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

async function redis(store: QuotaStore, command: (string | number)[]): Promise<unknown> {
  const response = await (store.fetcher ?? fetch)(store.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error('Quota store unavailable');
  const data = object(await response.json());
  if ('error' in data) throw new Error('Quota store unavailable');
  return data.result;
}

async function premiumFor(userId: string, settings: ServerConfig, fetcher: typeof fetch): Promise<boolean> {
  if (!settings.revenueCatKey) return false;
  const cacheKey = `ai:premium:${userId}`;
  const cached = await redis(settings.store, ['GET', cacheKey]);
  if (cached === '1') return true;
  if (cached === '0') return false;
  const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${settings.revenueCatKey}` },
  });
  if (!response.ok) throw new Error('Entitlement check unavailable');
  const body = object(await response.json());
  const entitlement = object(object(object(body.subscriber).entitlements).premium);
  const expires = entitlement.expires_date;
  const grace = entitlement.grace_period_expires_date;
  const premium = typeof entitlement.purchase_date === 'string'
    && (expires === null || (typeof expires === 'string' && Date.parse(expires) > Date.now())
      || (typeof grace === 'string' && Date.parse(grace) > Date.now()));
  await redis(settings.store, ['SET', cacheKey, premium ? '1' : '0', 'EX', 300]);
  return premium;
}

function requestIp(request: Request): string | null {
  const ip = request.headers.get('X-Real-IP');
  return ip && ip.length <= 64 ? ip : null;
}

export async function handleSession(request: Request, env: ServerEnv = process.env, fetcher: typeof fetch = fetch): Promise<Response> {
  const settings = config(env, fetcher);
  if (!settings) return json({ code: 'unavailable' }, 503);
  const ip = requestIp(request);
  if (!ip) return json({ code: 'unavailable' }, 503);
  try {
    if (!await allowSession(settings.store, await hashIp(ip))) return json({ code: 'burst_limit' }, 429);
    return json(await issueSession(settings.secret));
  } catch {
    return json({ code: 'unavailable' }, 503);
  }
}

export async function handleGenerate(request: Request, env: ServerEnv = process.env, fetcher: typeof fetch = fetch): Promise<Response> {
  const settings = config(env, fetcher);
  if (!settings) return json({ code: 'unavailable' }, 503);
  const ip = requestIp(request);
  if (!ip) return json({ code: 'unavailable' }, 503);
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const userId = await verifySession(settings.secret, token);
  if (!userId) return json({ code: 'unauthorized' }, 401);
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > 160_000) return json({ code: 'too_long' }, 413);
  let raw = '';
  if (!request.body) return json({ code: 'invalid_request' }, 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bodyLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyLength += value.byteLength;
      if (bodyLength > 160_000) {
        await reader.cancel();
        return json({ code: 'too_long' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let submitted: unknown;
  try { submitted = JSON.parse(raw); } catch { return json({ code: 'invalid_request' }, 400); }
  const parsed = requestSchema.safeParse(submitted);
  if (!parsed.success) return json({ code: 'invalid_request' }, 400);
  const { task, input, stream } = parsed.data;
  const reserved = reserveMicroUsd(`${instructions[task]} ${input} ${JSON.stringify(profileJsonSchema)}`, settings.inputRate, settings.outputRate);
  const now = new Date();
  try {
    const premium = await premiumFor(userId, settings, fetcher);
    const decision = await reserveQuota(settings.store, userId, await hashIp(ip), premium, reserved, now);
    if (decision !== 'allowed') return json({ code: decision, resetAt: resetAt(now), premium }, 429);
  } catch {
    return json({ code: 'unavailable' }, 503);
  }
  const providerCall = { provider: settings.provider, apiKey: settings.apiKey, model: settings.model, task, input, fetcher };
  if (!stream) {
    try {
      const result = await callProvider(providerCall);
      await settleQuota(settings.store, reserved, actualMicroUsd(result.usage, settings.inputRate, settings.outputRate), now).catch(() => undefined);
      const value = task === 'profile' ? profileSchema.parse(JSON.parse(result.text)) : result.text;
      return json({ result: value });
    } catch {
      return json({ code: 'provider_error' }, 502);
    }
  }
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, value: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
      void callProvider({ ...providerCall, onDelta: (delta) => send('delta', { text: delta }) })
        .then(async (result) => {
          await settleQuota(settings.store, reserved, actualMicroUsd(result.usage, settings.inputRate, settings.outputRate), now).catch(() => undefined);
          const value = task === 'profile' ? profileSchema.parse(JSON.parse(result.text)) : result.text;
          send('done', { result: value });
        })
        .catch(() => send('error', { code: 'provider_error' }))
        .finally(() => controller.close());
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } });
}
