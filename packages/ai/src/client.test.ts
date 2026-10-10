import assert from 'node:assert/strict';
import test from 'node:test';

import { createAiClient, resolveAiServerUrl } from './client.ts';

test('development AI requests use the Expo dev server and report only path and status', async () => {
  const originalStorage = globalThis.localStorage;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  try {
    const serverUrl = resolveAiServerUrl('AI_EAS_HOSTING_URL_PLACEHOLDER', 'localhost:8082', true);
    assert.equal(serverUrl, 'http://localhost:8082');
    assert.ok(serverUrl);
    const calls: string[] = [];
    const logs: [string, number | 'network-error'][] = [];
    const client = createAiClient({
      serverUrl,
      openModelBaseUrl: 'https://openrouter.ai/api/v1',
      openModel: 'openrouter/free',
      allowInsecureHttp: true,
      onRequest: (path, status) => logs.push([path, status]),
      fetcher: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/ai/session')) {
          return Response.json({ userId: '00000000-0000-4000-8000-000000000001', token: 'session-token' });
        }
        return Response.json({ whereIWas: 'Drafting', looseEnds: [], nextStep: 'Continue' });
      },
    });

    await client.split('A note to sort');

    assert.deepEqual(calls, ['http://localhost:8082/ai/session', 'http://localhost:8082/ai/split']);
    assert.deepEqual(logs, [['/ai/session', 200], ['/ai/split', 200]]);
  } finally {
    if (originalStorage === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  }
});

test('development server origin is not used outside development', () => {
  assert.equal(resolveAiServerUrl('AI_EAS_HOSTING_URL_PLACEHOLDER', 'localhost:8082', false), null);
  assert.equal(resolveAiServerUrl('https://ai.example.com', 'localhost:8082', false), 'https://ai.example.com');
});
