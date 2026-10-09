import type { Usage } from './provider.ts';

export type QuotaStore = { url: string; token: string; fetcher?: typeof fetch };
export type QuotaDecision = 'allowed' | 'daily_limit' | 'budget_limit' | 'burst_limit';
export type DailyLimits = { free: number; premium: number };
export const defaultDailyLimits: DailyLimits = { free: 5, premium: 25 };

const reserveScript = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local spend = tonumber(redis.call('GET', KEYS[2]) or '0')
local burst = tonumber(redis.call('GET', KEYS[3]) or '0')
if used >= tonumber(ARGV[1]) then return 1 end
if spend + tonumber(ARGV[2]) > tonumber(ARGV[3]) then return 2 end
if burst >= 10 then return 3 end
redis.call('INCR', KEYS[1])
redis.call('INCRBY', KEYS[2], ARGV[2])
redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[1], 172800)
redis.call('EXPIRE', KEYS[2], 172800)
redis.call('EXPIRE', KEYS[3], 60)
return 0`;

const sessionScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= 20 then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], 172800)
return 1`;

export async function redisEval(store: QuotaStore, script: string, keys: string[], args: (string | number)[]): Promise<number> {
  const response = await (store.fetcher ?? fetch)(store.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', script, keys.length, ...keys, ...args]),
  });
  if (!response.ok) throw new Error('Quota store unavailable');
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('result' in data) || typeof data.result !== 'number') {
    throw new Error('Quota store returned an invalid response');
  }
  return data.result;
}

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resetAt(now = new Date()): string {
  return `${new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function reserveMicroUsd(input: string, inputRate: number, outputRate: number): number {
  return Math.ceil((new TextEncoder().encode(input).length + 1_000) * inputRate + 1_500 * outputRate);
}

export function actualMicroUsd(usage: Usage, inputRate: number, outputRate: number): number {
  return Math.ceil(usage.inputTokens * inputRate + usage.outputTokens * outputRate);
}

export async function allowSession(store: QuotaStore, ipHash: string, now = new Date()): Promise<boolean> {
  return await redisEval(store, sessionScript, [`ai:session:${utcDay(now)}:${ipHash}`], []) === 1;
}

export async function reserveQuota(
  store: QuotaStore,
  userId: string,
  ipHash: string,
  premium: boolean,
  reservedMicroUsd: number,
  now = new Date(),
  dailyLimits: DailyLimits = defaultDailyLimits,
): Promise<QuotaDecision> {
  const day = utcDay(now);
  const minute = now.toISOString().slice(0, 16);
  const result = await redisEval(store, reserveScript,
    [`ai:user:${day}:${userId}`, `ai:spend:${day}`, `ai:burst:${minute}:${ipHash}`],
    [premium ? dailyLimits.premium : dailyLimits.free, reservedMicroUsd, 5_000_000]);
  return (['allowed', 'daily_limit', 'budget_limit', 'burst_limit'] as const)[result] ?? 'budget_limit';
}

export async function settleQuota(store: QuotaStore, reserved: number, actual: number, now = new Date()): Promise<void> {
  const difference = actual - reserved;
  if (difference !== 0) {
    await redisEval(store, `return redis.call('INCRBY', KEYS[1], ARGV[1])`, [`ai:spend:${utcDay(now)}`], [difference]);
  }
}
