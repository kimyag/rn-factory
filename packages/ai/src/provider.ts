import { instructions, profileJsonSchema, type AiTask } from './schema.ts';

export type ProviderName = 'openai' | 'anthropic' | 'openai-compatible';
export type Usage = { inputTokens: number; outputTokens: number };
export type ProviderResult = { text: string; usage: Usage };
export type ProviderCall = {
  provider: ProviderName;
  apiKey: string;
  model: string;
  baseUrl?: string;
  task: AiTask;
  input: string;
  onDelta?: (delta: string) => void;
  fetcher?: typeof fetch;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function contentText(value: unknown): string {
  return Array.isArray(value)
    ? value.map((item) => {
      const block = record(item);
      return block.type === 'text' || block.type === 'output_text' ? String(block.text ?? '') : '';
    }).join('')
    : '';
}

async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') {
          yield record(JSON.parse(data));
        }
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function callProvider({ provider, apiKey, model, baseUrl: configuredBaseUrl, task, input, onDelta, fetcher = fetch }: ProviderCall): Promise<ProviderResult> {
  const streaming = onDelta !== undefined;
  const openai = provider === 'openai';
  const compatible = provider === 'openai-compatible';
  const baseUrl = compatible ? configuredBaseUrl?.replace(/\/$/, '') : undefined;
  if (compatible && !baseUrl) throw new Error('OpenAI-compatible base URL unavailable');
  const response = await fetcher(openai
    ? 'https://api.openai.com/v1/responses'
    : compatible ? `${baseUrl}/chat/completions` : 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    redirect: compatible ? 'error' : 'follow',
    headers: openai || compatible
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
      : { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(openai
      ? {
        model, instructions: instructions[task], input, max_output_tokens: 1_500, store: false,
        ...(task === 'profile' ? { text: { format: { type: 'json_schema', name: 'teammate_profile', schema: profileJsonSchema, strict: true } } } : {}),
        stream: streaming,
      }
      : compatible
        ? {
          model,
          messages: [{
            role: 'system',
            content: task === 'profile'
              ? `${instructions[task]} Return only a JSON object matching this schema: ${JSON.stringify(profileJsonSchema)}`
              : instructions[task],
          }, { role: 'user', content: input }],
          max_tokens: 1_500,
          ...(task === 'profile' ? { response_format: { type: 'json_object' } } : {}),
          stream: streaming,
          ...(streaming ? { stream_options: { include_usage: true } } : {}),
        }
      : {
        model, system: instructions[task], messages: [{ role: 'user', content: input }], max_tokens: 1_500,
        ...(task === 'profile' ? { output_config: { format: { type: 'json_schema', schema: profileJsonSchema } } } : {}),
        stream: streaming,
      }),
  });
  if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
  if (!streaming) {
    const data = record(await response.json());
    const compatibleChoice = record(Array.isArray(data.choices) ? data.choices[0] : null);
    if (compatible && compatibleChoice.finish_reason !== 'stop') throw new Error('Provider response incomplete');
    const output = openai
      ? Array.isArray(data.output) ? data.output.map((item) => contentText(record(item).content)).join('') : ''
      : compatible
        ? String(record(compatibleChoice.message).content ?? '')
        : contentText(data.content);
    const usage = record(data.usage);
    return {
      text: output,
      usage: {
        inputTokens: number(compatible ? usage.prompt_tokens : usage.input_tokens),
        outputTokens: number(compatible ? usage.completion_tokens : usage.output_tokens),
      },
    };
  }
  if (!response.body) throw new Error('Provider stream unavailable');
  let text = '';
  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let completed = false;
  for await (const event of events(response.body)) {
    if (event.type === 'error') throw new Error('Provider stream failed');
    if (openai) {
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        text += event.delta;
        onDelta?.(event.delta);
      }
      if (event.type === 'response.completed') {
        const final = record(event.response);
        const counts = record(final.usage);
        usage = { inputTokens: number(counts.input_tokens), outputTokens: number(counts.output_tokens) };
        completed = true;
      }
      if (event.type === 'response.failed' || event.type === 'response.incomplete') throw new Error('Provider response incomplete');
    } else if (compatible) {
      const usageData = record(event.usage);
      if (Object.keys(usageData).length > 0) {
        usage = {
          inputTokens: number(usageData.prompt_tokens),
          outputTokens: number(usageData.completion_tokens),
        };
      }
      const choice = record(Array.isArray(event.choices) ? event.choices[0] : null);
      const delta = record(choice.delta);
      if (typeof delta.content === 'string') {
        text += delta.content;
        onDelta?.(delta.content);
      }
      if (choice.finish_reason === 'stop') completed = true;
      if (choice.finish_reason !== undefined && choice.finish_reason !== null && choice.finish_reason !== 'stop') {
        throw new Error('Provider response incomplete');
      }
    } else {
      if (event.type === 'message_start') {
        usage.inputTokens = number(record(record(event.message).usage).input_tokens);
      }
      if (event.type === 'content_block_delta') {
        const delta = record(event.delta);
        if (delta.type === 'text_delta' && typeof delta.text === 'string') {
          text += delta.text;
          onDelta?.(delta.text);
        }
      }
      if (event.type === 'message_delta') {
        usage.outputTokens = number(record(event.usage).output_tokens);
      }
      if (event.type === 'message_stop') completed = true;
    }
  }
  if (!completed) throw new Error('Provider stream ended early');
  return { text, usage };
}
