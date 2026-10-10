import assert from 'node:assert/strict';
import test from 'node:test';

import { handleSession } from './server.ts';

const baseEnv = {
  AI_MODULE_ENABLED: 'true',
  AI_PROVIDER: 'openai-compatible',
  AI_BASE_URL: 'https://openrouter.ai/api/v1',
  AI_MODEL: 'nvidia/nemotron-3-super-120b-a12b:free',
  AI_INPUT_USD_PER_MTOK: '0',
  AI_OUTPUT_USD_PER_MTOK: '0',
  OPENAI_COMPATIBLE_API_KEY: 'test-provider-key',
  AI_SIGNING_KEY: 'test-signing-key',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
};

const redisStub: typeof fetch = async (_input, _init) => Response.json({ result: 1 });

function request(url: string, withIpHeader = false): Request {
  return new Request(`${url}/ai/session`, {
    method: 'POST',
    headers: withIpHeader ? { 'X-Real-IP': '192.168.1.10' } : undefined,
  });
}

test('local development session requests work without a forwarded IP header', async () => {
  const response = await handleSession(
    request('http://192.168.1.20:8081'),
    { ...baseEnv, NODE_ENV: 'development' },
    redisStub,
  );

  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).token, 'string');
});

test('production returns 503 without X-Real-IP, even for a local URL', async () => {
  const response = await handleSession(
    request('http://192.168.1.20:8081'),
    { ...baseEnv, NODE_ENV: 'production' },
    redisStub,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'unavailable' });
});

test('EAS Hosting URLs cannot use the development fallback', async () => {
  const response = await handleSession(
    request('https://template-app.expo.app'),
    { ...baseEnv, NODE_ENV: 'development' },
    redisStub,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'unavailable' });
});

test('forwarded IP requests continue to work in production', async () => {
  const response = await handleSession(
    request('https://template-app.expo.app', true),
    { ...baseEnv, NODE_ENV: 'production' },
    redisStub,
  );

  assert.equal(response.status, 200);
});
