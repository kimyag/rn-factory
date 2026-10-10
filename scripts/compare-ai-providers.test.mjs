import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const mock = `
import assert from 'node:assert/strict';
const calls = [];
globalThis.fetch = async (url, options) => {
  if (url === 'https://openrouter.ai/api/v1/models') {
    return Response.json({ data: ['test/one:free', 'test/two:free'].map(id => ({
      id, pricing: { prompt: process.env.MOCK_CATALOG_PAID ? '0.001' : '0', completion: '0' },
      supported_parameters: ['structured_outputs'],
    })) });
  }
  const body = JSON.parse(options.body);
  const provider = url.includes('api.openai.com') ? 'openai'
    : url.includes('api.anthropic.com') ? 'anthropic'
    : url.startsWith('https://openrouter.ai/api/v1/') ? 'openai-compatible' : null;
  assert.ok(provider, 'unexpected provider URL');
  assert.ok(options.signal);
  calls.push({ provider, input: body.input ?? body.messages.at(-1).content });
  if (process.env.MOCK_ONE_FAILURE && body.model === 'test/one:free') return new Response('', { status: 503 });
  const profile = process.env.MOCK_INVALID ? { summary: 'Missing fields' }
    : { summary: 'Observed behavior', strengths: ['Clear notes'], workingStyle: 'Collaborative', growthAreas: [] };
  const text = JSON.stringify(profile);
  if (process.env.MOCK_HTTP_ERROR) return new Response('PRIVATE_PROVIDER_ERROR', { status: 401 });
  if (provider === 'openai') {
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    return Response.json({ status: process.env.MOCK_TRUNCATED ? 'incomplete' : 'completed',
      output: [{ content: [{ type: 'output_text', text }] }], usage: { input_tokens: 100, output_tokens: 200 } });
  }
  if (provider === 'anthropic') {
    assert.equal(body.output_config.format.type, 'json_schema');
    return Response.json({ content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 200 } });
  }
  assert.equal(body.response_format.type, process.env.AI_COMPARE_ROUTE === 'openrouter' ? 'json_schema' : 'json_object');
  if (process.env.AI_COMPARE_ROUTE === 'openrouter') {
    assert.equal(options.headers.Authorization, 'Bearer test-compatible');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.provider.require_parameters, true);
  }
  return Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 100, completion_tokens: 200 } });
};
process.on('exit', () => {
  if (process.exitCode || process.env.MOCK_INVALID || process.env.MOCK_TRUNCATED || process.env.MOCK_HTTP_ERROR) return;
  const providers = (process.env.AI_COMPARE_PROVIDERS ?? 'openai,anthropic').split(',');
  assert.equal(calls.length, 3 * providers.length);
  for (let index = 0; index < calls.length; index += providers.length) {
    assert.equal(new Set(calls.slice(index, index + providers.length).map(call => call.input)).size, 1);
  }
});
`;

function run(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(AI_|OPENAI_|OPENROUTER_|ANTHROPIC_|MOCK_)/.test(name)));
  return spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--import',
    `data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`,
    'scripts/compare-ai-providers.mjs',
  ], {
    cwd: root,
    env: { ...env, OPENAI_API_KEY: 'test-openai', ANTHROPIC_API_KEY: 'test-anthropic', ...extra },
    encoding: 'utf8', timeout: 10_000,
  });
}

test('the default comparison needs only OpenAI and Anthropic and reports validated results and cost', () => {
  const result = run({ OPENAI_COMPATIBLE_MODEL: 'unused-model-without-prices' });
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.trim().split(/\n(?=\{)/).map((row) => JSON.parse(row));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.deepEqual(row.results.map(({ provider }) => provider), ['openai', 'anthropic']);
    assert.deepEqual(row.results[0].usage, { input: 100, output: 200 });
    assert.equal(row.results[0].estimatedUsd, 0.00011);
    assert.equal(row.results[1].estimatedUsd, 0.0011);
    assert.deepEqual(row.results[0].profile.growthAreas, []);
  }
});

test('the compatible provider can be explicitly included', () => {
  const result = run({ AI_COMPARE_PROVIDERS: 'openai,anthropic,openai-compatible', OPENAI_COMPATIBLE_API_KEY: 'test-compatible' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/"provider": "openai-compatible"/g) ?? []).length, 3);
});

test('OpenRouter compares OpenAI and Anthropic models with one key and routed token usage', () => {
  const result = run({ AI_COMPARE_ROUTE: 'openrouter', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', OPENAI_COMPATIBLE_API_KEY: 'test-compatible' });
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.trim().split(/\n(?=\{)/).map((row) => JSON.parse(row));
  for (const row of rows) {
    assert.deepEqual(row.results.map(({ provider, route, model }) => ({ provider, route, model })), [
      { provider: 'openai', route: 'openrouter', model: 'openai/gpt-6-luna' },
      { provider: 'anthropic', route: 'openrouter', model: 'anthropic/claude-haiku-4.5' },
    ]);
    assert.equal(row.results[0].estimatedUsd, 0.00011);
    assert.equal(row.results[1].estimatedUsd, 0.0011);
  }
});

test('free comparison verifies catalog prices, compares both models, and reports zero token cost', () => {
  const result = run({ AI_COMPARE_ROUTE: 'openrouter', OPENROUTER_FREE_MODELS: 'test/one:free,test/two:free',
    OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', OPENAI_COMPATIBLE_API_KEY: 'test-compatible' });
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.trim().split(/\n(?=\{)/).map((row) => JSON.parse(row));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.deepEqual(row.results.map(({ model }) => model), ['test/one:free', 'test/two:free']);
    assert.ok(row.results.every(({ estimatedUsd }) => estimatedUsd === 0));
  }
});

test('free comparison refuses paid or unlisted models before inference', () => {
  for (const extra of [
    { MOCK_CATALOG_PAID: '1' },
    { OPENROUTER_FREE_MODELS: 'test/one:free,test/missing:free' },
    { OPENROUTER_FREE_MODELS: 'test/one:free,test/paid' },
  ]) {
    const result = run({ AI_COMPARE_ROUTE: 'openrouter', OPENROUTER_FREE_MODELS: 'test/one:free,test/two:free',
      OPENAI_COMPATIBLE_API_KEY: 'test-compatible', ...extra });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /free model IDs|free structured-output model/);
  }
});

test('one failing free endpoint preserves the other model results and exits unsuccessfully', () => {
  const result = run({ AI_COMPARE_ROUTE: 'openrouter', OPENROUTER_FREE_MODELS: 'test/one:free,test/two:free',
    OPENAI_COMPATIBLE_API_KEY: 'test-compatible', MOCK_ONE_FAILURE: '1' });
  assert.equal(result.status, 1);
  const rows = result.stdout.trim().split(/\n(?=\{)/).map((row) => JSON.parse(row));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.match(row.results[0].error, /HTTP 503/);
    assert.equal(row.results[1].estimatedUsd, 0);
    assert.ok(row.results[1].profile);
  }
});

test('missing credentials and invalid selections fail before provider requests', () => {
  for (const extra of [
    { ANTHROPIC_API_KEY: '' },
    { AI_COMPARE_PROVIDERS: 'openai,anthropic,openai-compatible' },
    { AI_COMPARE_PROVIDERS: 'openai,unknown' },
    { AI_COMPARE_PROVIDERS: 'openai,openai' },
    { AI_COMPARE_PROVIDERS: 'openai' },
    { AI_OPENAI_MODEL: 'custom-without-prices' },
    { AI_COMPARE_ROUTE: 'openrouter' },
    { AI_COMPARE_ROUTE: 'unknown' },
    { AI_COMPARE_ROUTE: 'openrouter', OPENAI_COMPATIBLE_API_KEY: 'test-compatible', OPENROUTER_OPENAI_MODEL: 'custom-without-prices' },
  ]) {
    const result = run(extra);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /required|AI_COMPARE_PROVIDERS|AI_COMPARE_ROUTE|estimate its cost/);
  }
});

test('invalid profiles and incomplete responses are rejected', () => {
  for (const extra of [{ MOCK_INVALID: '1' }, { MOCK_TRUNCATED: '1' }]) {
    const result = run(extra);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});

test('HTTP errors report status without exposing provider response text', () => {
  const result = run({ MOCK_HTTP_ERROR: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTP 401/);
  assert.doesNotMatch(result.stderr, /PRIVATE_PROVIDER_ERROR/);
});
