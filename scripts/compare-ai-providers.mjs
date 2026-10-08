const openAiModel = process.env.AI_OPENAI_MODEL ?? 'gpt-6-luna';
const anthropicModel = process.env.AI_ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
const compatibleBaseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL ?? 'https://openrouter.ai/api/v1';
const compatibleModel = process.env.OPENAI_COMPATIBLE_MODEL ?? 'openai/gpt-oss-20b:free';
const openAiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const compatibleKey = process.env.OPENAI_COMPATIBLE_API_KEY;

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    workingStyle: { type: 'string' },
    growthAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'strengths', 'workingStyle', 'growthAreas'],
  additionalProperties: false,
};

const samples = [
  'Mina led the weekly design review, asked quiet teammates for input, and turned vague feedback into clear next steps. She shared early drafts and adjusted quickly when research contradicted her first idea.',
  'Jonas is calm during incidents and writes careful handoff notes. He knows the data pipeline well and helps unblock others. He sometimes waits too long to flag a delivery risk because he wants to solve it alone first.',
  'Leila explains difficult technical choices in plain language. She pairs patiently with new engineers and notices edge cases. She prefers a written agenda before large meetings and can be direct when a decision is overdue.',
];

const rates = {
  openai: {
    input: rate('OPENAI_INPUT_USD_PER_MTOK', openAiModel, 'gpt-6-luna', 0.1),
    output: rate('OPENAI_OUTPUT_USD_PER_MTOK', openAiModel, 'gpt-6-luna', 0.5),
  },
  anthropic: {
    input: rate('ANTHROPIC_INPUT_USD_PER_MTOK', anthropicModel, 'claude-haiku-4-5-20251001', 1),
    output: rate('ANTHROPIC_OUTPUT_USD_PER_MTOK', anthropicModel, 'claude-haiku-4-5-20251001', 5),
  },
  'openai-compatible': {
    input: rate('OPENAI_COMPATIBLE_INPUT_USD_PER_MTOK', compatibleModel, 'openai/gpt-oss-20b:free', 0),
    output: rate('OPENAI_COMPATIBLE_OUTPUT_USD_PER_MTOK', compatibleModel, 'openai/gpt-oss-20b:free', 0),
  },
};

function rate(variable, model, defaultModel, defaultRate) {
  const value = process.env[variable];
  if (value === undefined && model !== defaultModel) {
    throw new Error(`Set ${variable} for model ${model} to estimate its cost.`);
  }
  const result = value === undefined ? defaultRate : Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${variable} must be a non-negative number.`);
  return result;
}

function requiredKey(value, name) {
  if (!value || value.endsWith('_PLACEHOLDER')) throw new Error(`${name} is required to compare providers.`);
  return value;
}

async function compare(provider, model, sample) {
  const started = performance.now();
  const response = provider === 'openai'
    ? await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${requiredKey(openAiKey, 'OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: 'Create a concise work profile using only supplied observations. Do not infer sensitive traits or invent facts. Use an empty array when there is not enough evidence.',
        input: sample,
        max_output_tokens: 1_500,
        store: false,
        text: { format: { type: 'json_schema', name: 'teammate_profile', schema, strict: true } },
      }),
    })
    : provider === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': requiredKey(anthropicKey, 'ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: 'Create a concise work profile using only supplied observations. Do not infer sensitive traits or invent facts. Use an empty array when there is not enough evidence.',
        messages: [{ role: 'user', content: sample }],
        max_tokens: 1_500,
        output_config: { format: { type: 'json_schema', schema } },
      }),
      })
      : await fetch(`${compatibleBaseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requiredKey(compatibleKey, 'OPENAI_COMPATIBLE_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Create a concise work profile using only supplied observations. Do not infer sensitive traits or invent facts. Use an empty array when there is not enough evidence.' },
            { role: 'user', content: sample },
          ],
          max_tokens: 1_500,
          response_format: { type: 'json_object' },
        }),
      });

  if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const raw = provider === 'openai'
    ? (body.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text
    : provider === 'anthropic'
      ? body.content?.find((item) => item.type === 'text')?.text
      : body.choices?.[0]?.message?.content;
  if (typeof raw !== 'string') throw new Error(`${provider} returned no structured text.`);
  const usage = provider === 'openai'
    ? { input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 }
    : provider === 'anthropic'
      ? { input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 }
      : { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 };
  const pricing = rates[provider];
  return {
    provider,
    model,
    elapsedMs: Math.round(performance.now() - started),
    usage,
    estimatedUsd: Number(((usage.input * pricing.input + usage.output * pricing.output) / 1_000_000).toFixed(8)),
    profile: JSON.parse(raw),
  };
}

try {
  requiredKey(openAiKey, 'OPENAI_API_KEY');
  requiredKey(anthropicKey, 'ANTHROPIC_API_KEY');
  requiredKey(compatibleKey, 'OPENAI_COMPATIBLE_API_KEY');
  for (const [index, sample] of samples.entries()) {
    const [openai, anthropic, compatible] = await Promise.all([
      compare('openai', openAiModel, sample),
      compare('anthropic', anthropicModel, sample),
      compare('openai-compatible', compatibleModel, sample),
    ]);
    process.stdout.write(`${JSON.stringify({ sample: index + 1, input: sample, results: [openai, anthropic, compatible] }, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
