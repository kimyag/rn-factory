import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appScopedQuotaKey, reserveQuota, utcDay, type QuotaStore } from './quota.ts';
import { handleGenerate, handleSplit, handleTranscribe } from './server.ts';
import { issueSession } from './identity.ts';
import { callProvider } from './provider.ts';
import { allowSession, settleQuota } from './quota.ts';

type Entry = { value: number; expiresAt: number };

function fakeUpstash() {
  const values = new Map<string, Entry>();
  const fetcher: typeof fetch = async (_input, init) => {
    const [command, script, keyCount, ...rest] = JSON.parse(String(init?.body)) as [string, string, number, ...(string | number)[]];
    assert.equal(command, 'EVAL');
    const keys = rest.slice(0, keyCount).map(String);
    const args = rest.slice(keyCount).map(Number);
    const now = Date.now();
    const get = (key: string) => {
      const entry = values.get(key);
      if (!entry || entry.expiresAt <= now) {
        values.delete(key);
        return 0;
      }
      return entry.value;
    };
    const increment = (key: string, amount: number, ttl: number) => {
      const value = get(key) + amount;
      values.set(key, { value, expiresAt: now + ttl * 1_000 });
      return value;
    };
    let result: number;
    if (script.includes("redis.call('INCRBY', KEYS[1], ARGV[1])")) {
      result = increment(keys[0]!, args[0]!, 172_800);
    } else if (keys[0]?.includes(':ai:user:')) {
      const [limit, reserved, cap] = args;
      if (get(keys[0]!) >= limit!) result = 1;
      else if (get(keys[1]!) + reserved! > cap!) result = 2;
      else if (get(keys[2]!) >= 10) result = 3;
      else {
        increment(keys[0]!, 1, 172_800);
        increment(keys[1]!, reserved!, 172_800);
        increment(keys[2]!, 1, 60);
        result = 0;
      }
    } else if (keys[0]?.includes(':ai:session:')) {
      increment(keys[0], 1, 172_800);
      result = 1;
    } else {
      result = 0;
    }
    return Response.json({ result });
  };
  const store: QuotaStore = { url: 'https://upstash.test', token: 'fake', fetcher };
  return { store, values };
}

const at = (date: string) => new Date(date);

test('UTC day keys change exactly at midnight UTC', () => {
  assert.equal(utcDay(at('2026-10-06T23:59:59.999Z')), '2026-10-06');
  assert.equal(utcDay(at('2026-10-07T00:00:00.000Z')), '2026-10-07');
});

test('daily usage resets on the next UTC date', async () => {
  const { store } = fakeUpstash();
  const firstDay = at('2026-10-06T23:59:00.000Z');
  for (let i = 0; i < 5; i++) assert.equal(await reserveQuota(store, 'u1', 'ip', false, 1, firstDay), 'allowed');
  assert.equal(await reserveQuota(store, 'u1', 'ip', false, 1, firstDay), 'daily_limit');
  assert.equal(await reserveQuota(store, 'u1', 'ip', false, 1, at('2026-10-07T00:00:00.000Z')), 'allowed');
});

test('free and premium users have distinct daily limits', async () => {
  const { store } = fakeUpstash();
  const now = at('2026-10-06T12:00:00.000Z');
  for (let i = 0; i < 5; i++) assert.equal(await reserveQuota(store, 'free', `free-${i}`, false, 1, now), 'allowed');
  assert.equal(await reserveQuota(store, 'free', 'free-next', false, 1, now), 'daily_limit');
  for (let i = 0; i < 25; i++) assert.equal(await reserveQuota(store, 'premium', `premium-${i}`, true, 1, now), 'allowed');
  assert.equal(await reserveQuota(store, 'premium', 'premium-next', true, 1, now), 'daily_limit');
});

test('daily quotas can be set per app and preserve the global spend limit', async () => {
  const { store, values } = fakeUpstash();
  const now = at('2026-10-06T12:00:00.000Z');
  const limits = { free: 60, premium: 25 };
  for (let i = 0; i < 60; i++) assert.equal(await reserveQuota(store, 'switch-free', `ip-${i}`, false, 0, now, limits), 'allowed');
  assert.equal(await reserveQuota(store, 'switch-free', 'ip-next', false, 0, now, limits), 'daily_limit');
  values.set(appScopedQuotaKey('template-app', 'ai:spend:2026-10-06'), { value: 5_000_000, expiresAt: Date.now() + 172_800_000 });
  assert.equal(await reserveQuota(store, 'switch-premium', 'ip-premium', true, 1, now, limits), 'budget_limit');
});

test('global daily cost cap rejects a reservation that would exceed the cap', async () => {
  const { store, values } = fakeUpstash();
  values.set(appScopedQuotaKey('template-app', 'ai:spend:2026-10-06'), { value: 4_999_999, expiresAt: Date.now() + 172_800_000 });
  assert.equal(await reserveQuota(store, 'u1', 'ip', false, 2, at('2026-10-06T12:00:00.000Z')), 'budget_limit');
  assert.equal(await reserveQuota(store, 'u1', 'ip', false, 1, at('2026-10-06T12:00:00.000Z')), 'allowed');
});

test('simultaneous reservations cannot exceed a daily limit', async () => {
  const { store } = fakeUpstash();
  const now = at('2026-10-06T12:00:00.000Z');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserveQuota(store, 'u1', `ip-${i}`, false, 1, now)));
  assert.equal(results.filter((result) => result === 'allowed').length, 5);
  assert.equal(results.filter((result) => result === 'daily_limit').length, 7);
});

test('server denies a limit hit without calling the fake provider', async () => {
  const { store, values } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  values.set(appScopedQuotaKey('template-app', `ai:user:${utcDay()}:${session.userId}`), { value: 5, expiresAt: Date.now() + 172_800_000 });
  let providerCalls = 0;
  const fakeFetch: typeof fetch = (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Promise.resolve(Response.json({
      output: [{ content: [{ type: 'output_text', text: '{"summary":"","strengths":[],"workingStyle":"","growthAreas":[]}' }] }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }));
  };
  const response = await handleGenerate(new Request('https://app.test/ai/generate', {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' },
    body: JSON.stringify({ task: 'profile', input: 'A teammate description', stream: false }),
  }), {
    AI_MODULE_ENABLED: 'true', AI_PROVIDER: 'openai', AI_MODEL: 'gpt-6-luna', OPENAI_API_KEY: 'test-provider-key',
    AI_SIGNING_KEY: 'test-signing-secret', UPSTASH_REDIS_REST_URL: store.url, UPSTASH_REDIS_REST_TOKEN: 'test-upstash-token',
  }, fakeFetch);
  assert.equal(response.status, 429);
  assert.equal(providerCalls, 0);
});

function dumpEnv(store: QuotaStore) {
  return {
    AI_MODULE_ENABLED: 'true', AI_PROVIDER: 'openai-compatible', AI_MODEL: 'nvidia/nemotron-3-super-120b-a12b:free',
    AI_BASE_URL: 'https://openrouter.ai/api/v1', AI_INPUT_USD_PER_MTOK: '0', AI_OUTPUT_USD_PER_MTOK: '0',
    OPENAI_COMPATIBLE_API_KEY: 'test-openrouter-key', GROQ_API_KEY: 'test-groq-key', AI_SIGNING_KEY: 'test-signing-secret',
    UPSTASH_REDIS_REST_URL: store.url, UPSTASH_REDIS_REST_TOKEN: 'test-upstash-token',
  };
}

function authedRequest(url: string, token: string, body: BodyInit, headers: Record<string, string> = {}) {
  return new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Real-IP': '192.0.2.1', ...headers }, body });
}

test('transcription sends audio only to Groq and returns detected language without storing the transcript', async () => {
  const { store, values } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    assert.equal(String(input), 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-groq-key');
    const form = init?.body as FormData;
    assert.equal(form.get('model'), 'whisper-large-v3-turbo');
    assert.equal(form.get('response_format'), 'verbose_json');
    return Response.json({ text: 'Please send the document.', language: 'Turkish', duration: 12 });
  };
  const form = new FormData();
  form.append('audio', new File(['audio bytes'], 'clip.m4a', { type: 'audio/mp4' }));
  const response = await handleTranscribe(authedRequest('https://app.test/ai/transcribe', session.token, form), dumpEnv(store), fetcher);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'Please send the document.', language: 'Turkish' });
  assert.equal(providerCalls, 1);
  assert.equal([...values.keys()].some((key) => key.includes('transcript')), false);
});

test('split asks for strict structured output, preserves language and validates the provider response', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const response = await handleSplit(authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'Yarın raporu gözden geçir.', detectedLanguage: 'Turkish' }), { 'Content-Type': 'application/json' }), dumpEnv(store), async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    assert.equal(String(input), 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-openrouter-key');
    assert.equal(init?.redirect, 'error');
    const payload = JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[]; response_format: { json_schema: { strict: boolean } } };
    assert.equal(payload.model, 'nvidia/nemotron-3-super-120b-a12b:free');
    assert.match(payload.messages[0]!.content, /Preserve its language/);
    assert.match(payload.messages[0]!.content, /Turkish/);
    assert.equal(payload.response_format.json_schema.strict, true);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ whereIWas: 'Raporu hazırlıyorum.', looseEnds: ['Verileri doğrula.'], nextStep: 'Raporu gözden geçir.' }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 12 } });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { whereIWas: 'Raporu hazırlıyorum.', looseEnds: ['Verileri doğrula.'], nextStep: 'Raporu gözden geçir.' });
  assert.equal(providerCalls, 1);
});

test('split rejects invalid provider shape and daily limits before extra calls', async () => {
  const { store, values } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const request = () => authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'A valid note', detectedLanguage: 'English' }), { 'Content-Type': 'application/json' });
  const env = dumpEnv(store);
  const invalid = await handleSplit(request(), env, async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Response.json({ choices: [{ message: { content: '{"whereIWas":"Only one field"}' }, finish_reason: 'stop' }] });
  });
  assert.equal(invalid.status, 502);
  assert.equal(providerCalls, 3);
  providerCalls = 0;
  values.set(appScopedQuotaKey('template-app', `ai:user:${utcDay()}:${session.userId}`), { value: 60, expiresAt: Date.now() + 172_800_000 });
  const limited = await handleSplit(request(), env, async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Response.json({});
  }, { free: 60, premium: 25 });
  assert.equal(limited.status, 429);
  assert.equal(providerCalls, 0);
});

test('split falls back after an unusable primary response and quota is reserved once', async () => {
  const { store, values } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  const models: string[] = [];
  const response = await handleSplit(authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'A valid note', detectedLanguage: 'English' }), { 'Content-Type': 'application/json' }), { ...dumpEnv(store), APP_SLUG: 'switch-companion' }, async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    const payload = JSON.parse(String(init?.body)) as { model: string };
    models.push(payload.model);
    if (models.length === 1) return Response.json({ choices: [{ message: { content: '{bad json' }, finish_reason: 'stop' }] });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ whereIWas: 'Working', looseEnds: [], nextStep: 'Continue' }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 12 } });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(models, ['nvidia/nemotron-3-super-120b-a12b:free', 'qwen/qwen3.8-27b:free']);
  assert.equal(values.get(appScopedQuotaKey('switch-companion', `ai:user:${utcDay()}:${session.userId}`))?.value, 1);
});

test('AI_FALLBACK_MODELS overrides the built-in split fallback list', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  const models: string[] = [];
  const response = await handleSplit(authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'A valid note', detectedLanguage: 'English' }), { 'Content-Type': 'application/json' }), {
    ...dumpEnv(store), APP_SLUG: 'switch-companion', AI_FALLBACK_MODELS: ' vendor/backup-one:free, vendor/backup-two:free, vendor/backup-two:free ',
  }, async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    const payload = JSON.parse(String(init?.body)) as { model: string };
    models.push(payload.model);
    if (payload.model !== 'vendor/backup-one:free') return Response.json({ error: 'unavailable' }, { status: 503 });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ whereIWas: 'Working', looseEnds: [], nextStep: 'Continue' }) }, finish_reason: 'stop' }] });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(models, ['nvidia/nemotron-3-super-120b-a12b:free', 'vendor/backup-one:free']);
});

test('split exhausts exactly three model attempts then returns 502 without logging content', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const response = await handleSplit(authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'private note content', detectedLanguage: 'English' }), { 'Content-Type': 'application/json' }),
  { ...dumpEnv(store), NODE_ENV: 'development' }, async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    const payload = JSON.parse(String(init?.body)) as { model: string };
    assert.ok(payload.model.endsWith(':free'));
    return Response.json({ choices: [{ message: { content: '{invalid' }, finish_reason: 'stop' }] });
  });
  assert.equal(response.status, 502);
  assert.equal(providerCalls, 3);
  assert.deepEqual(await response.json(), { code: 'provider_error' });
});

test('split logs only the model that answered in development', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  const originalWrite = process.stdout.write;
  const logs: unknown[][] = [];
  process.stdout.write = ((chunk: string | Uint8Array) => {
    logs.push([String(chunk).trimEnd()]);
    return true;
  }) as typeof process.stdout.write;
  try {
    const response = await handleSplit(authedRequest('https://app.test/ai/split', session.token,
    JSON.stringify({ text: 'secret user note', detectedLanguage: 'English' }), { 'Content-Type': 'application/json' }),
    { ...dumpEnv(store), APP_SLUG: 'switch-companion', NODE_ENV: 'development' }, async (input, init) => {
      if (String(input) === store.url) return store.fetcher!(input, init);
      const payload = JSON.parse(String(init?.body)) as { model: string };
      if (payload.model === 'nvidia/nemotron-3-super-120b-a12b:free') return Response.json({ error: 'unavailable' }, { status: 503 });
      return Response.json({ choices: [{ message: { content: JSON.stringify({ whereIWas: 'Working', looseEnds: [], nextStep: 'Continue' }) }, finish_reason: 'stop' }] });
    });
    assert.equal(response.status, 200);
  } finally {
    process.stdout.write = originalWrite;
  }
  assert.deepEqual(logs, [['[AI split] model=qwen/qwen3.8-27b:free']]);
});

test('session, quota, spend, burst, and premium keys are prefixed with the app slug', async () => {
  const { store, values } = fakeUpstash();
  const now = at('2026-10-06T12:34:00.000Z');
  await allowSession(store, 'switch-companion', 'ip-hash', now);
  await allowSession(store, 'template-app', 'ip-hash', now);
  await reserveQuota(store, 'user-1', 'ip-hash', false, 1, now, undefined, 'switch-companion');
  await reserveQuota(store, 'user-1', 'ip-hash', false, 1, now, undefined, 'template-app');
  await settleQuota(store, 1, 2, now, 'switch-companion');
  assert.ok([...values.keys()].some((key) => key.startsWith('switch-companion:')));
  assert.ok([...values.keys()].some((key) => key.startsWith('template-app:')));
  assert.ok([...values.keys()].some((key) => key.includes(':ai:session:')));
  assert.ok([...values.keys()].some((key) => key.includes(':ai:user:')));
  assert.ok([...values.keys()].some((key) => key.includes(':ai:spend:')));
  assert.ok([...values.keys()].some((key) => key.includes(':ai:burst:')));
  assert.equal(appScopedQuotaKey('switch-companion', 'ai:user:2026-10-06:user-1'), 'switch-companion:ai:user:2026-10-06:user-1');
  assert.equal(appScopedQuotaKey('template-app', 'ai:premium:user-1'), 'template-app:ai:premium:user-1');
  assert.notEqual(appScopedQuotaKey('switch-companion', 'ai:user:2026-10-06:user-1'), appScopedQuotaKey('template-app', 'ai:user:2026-10-06:user-1'));
});

function openModelEnv(store: QuotaStore) {
  return {
    AI_MODULE_ENABLED: 'true', AI_PROVIDER: 'openai-compatible', AI_MODEL: 'openai/gpt-oss-20b:free',
    AI_BASE_URL: 'https://trusted.test/v1', AI_INPUT_USD_PER_MTOK: '0', AI_OUTPUT_USD_PER_MTOK: '0',
    OPENAI_COMPATIBLE_API_KEY: 'test-open-model-key', AI_SIGNING_KEY: 'test-signing-secret',
    UPSTASH_REDIS_REST_URL: store.url, UPSTASH_REDIS_REST_TOKEN: 'test-upstash-token',
  };
}

test('compatible provider rejects an app endpoint that does not match the server allowlist', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const response = await handleGenerate(new Request('https://app.test/ai/generate', {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' },
    body: JSON.stringify({
      task: 'profile', input: 'A teammate description', stream: false,
      openModelBaseUrl: 'https://attacker.test/v1', openModel: 'openai/gpt-oss-20b:free',
    }),
  }), openModelEnv(store), async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Response.json({});
  });
  assert.equal(response.status, 400);
  assert.equal(providerCalls, 0);
});

test('compatible provider retries invalid profile JSON exactly once and keeps its key server-side', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  const calls: RequestInit[] = [];
  const outputs = ['not JSON', '{"summary":"Clear communicator","strengths":[],"workingStyle":"Collaborative","growthAreas":[]}'];
  const response = await handleGenerate(new Request('https://app.test/ai/generate', {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' },
    body: JSON.stringify({
      task: 'profile', input: 'Observed behavior', stream: false,
      openModelBaseUrl: 'https://trusted.test/v1', openModel: 'openai/gpt-oss-20b:free',
    }),
  }), openModelEnv(store), async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    assert.equal(String(input), 'https://trusted.test/v1/chat/completions');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-open-model-key');
    assert.equal(init?.redirect, 'error');
    calls.push(init ?? {});
    return Response.json({
      choices: [{ message: { content: outputs[calls.length - 1] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const body = await response.json() as { result: { summary: string } };
  assert.equal(body.result.summary, 'Clear communicator');
  const firstPayload = JSON.parse(String(calls[0]?.body)) as { messages: { content: string }[] };
  const retryPayload = JSON.parse(String(calls[1]?.body)) as { messages: { content: string }[] };
  assert.match(firstPayload.messages[0]!.content, /growthAreas/);
  assert.match(retryPayload.messages[1]!.content, /previous attempt was invalid/);
});

test('compatible provider uses one call when the first profile is valid', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const response = await handleGenerate(new Request('https://app.test/ai/generate', {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' },
    body: JSON.stringify({
      task: 'profile', input: 'Observed behavior', stream: false,
      openModelBaseUrl: 'https://trusted.test/v1', openModel: 'openai/gpt-oss-20b:free',
    }),
  }), openModelEnv(store), async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Response.json({
      choices: [{ message: { content: '{"summary":"Ready","strengths":[],"workingStyle":"","growthAreas":[]}', }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  });
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
});

test('compatible provider stops after one retry when both profiles are invalid', async () => {
  const { store } = fakeUpstash();
  const session = await issueSession('test-signing-secret');
  let providerCalls = 0;
  const response = await handleGenerate(new Request('https://app.test/ai/generate', {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1' },
    body: JSON.stringify({
      task: 'profile', input: 'Observed behavior', stream: false,
      openModelBaseUrl: 'https://trusted.test/v1', openModel: 'openai/gpt-oss-20b:free',
    }),
  }), openModelEnv(store), async (input, init) => {
    if (String(input) === store.url) return store.fetcher!(input, init);
    providerCalls++;
    return Response.json({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] });
  });
  assert.equal(response.status, 502);
  assert.equal(providerCalls, 2);
});

test('compatible non-streaming calls reject truncated output', async () => {
  await assert.rejects(callProvider({
    provider: 'openai-compatible', apiKey: 'secret', baseUrl: 'https://trusted.test/v1',
    model: 'test-model', task: 'answer', input: 'hello',
    fetcher: async () => Response.json({
      choices: [{ message: { content: 'partial' }, finish_reason: 'length' }],
    }),
  }), /Provider response incomplete/);
});

test('compatible streaming call rejects a truncated response', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'));
      controller.close();
    },
  });
  await assert.rejects(callProvider({
    provider: 'openai-compatible', apiKey: 'secret', baseUrl: 'https://trusted.test/v1',
    model: 'test-model', task: 'answer', input: 'hello', onDelta: () => undefined,
    fetcher: async () => new Response(stream),
  }), /Provider response incomplete/);
});
