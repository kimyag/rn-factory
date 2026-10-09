import { storedValue } from '@factory/core/storage';
import { fetch as expoFetch } from 'expo/fetch';
import { z } from 'zod';

import { dumpSplitSchema } from './dump-providers.ts';
import { inputSchema, profileSchema, type AiTask, type TeammateProfile } from './schema.ts';

const sessionSchema = z.strictObject({ userId: z.uuid(), token: z.string().min(1) });
const savedSession = storedValue({ key: 'ai.session', schema: sessionSchema.nullable(), fallback: null });

export type AiErrorCode = 'unavailable' | 'unauthorized' | 'too_long' | 'invalid_request' | 'daily_limit' | 'budget_limit' | 'burst_limit' | 'provider_error' | 'cancelled';
export type DumpSplit = z.output<typeof dumpSplitSchema>;
export type Transcription = { text: string; language: string };

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly resetAt: string | undefined;
  readonly premium: boolean | undefined;

  constructor(code: AiErrorCode, resetAt?: string, premium?: boolean) {
    super(code);
    this.code = code;
    this.resetAt = resetAt;
    this.premium = premium;
  }
}

type Session = z.output<typeof sessionSchema>;
type ClientOptions = {
  serverUrl: string;
  openModelBaseUrl: string;
  openModel: string;
  identify?: (userId: string) => Promise<void>;
  fetcher?: typeof fetch;
};

function dataObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function asError(value: unknown): AiError {
  const data = dataObject(value);
  const code = typeof data.code === 'string' ? data.code : 'unavailable';
  const known: AiErrorCode[] = ['unavailable', 'unauthorized', 'too_long', 'invalid_request', 'daily_limit', 'budget_limit', 'burst_limit', 'provider_error', 'cancelled'];
  return new AiError(known.includes(code as AiErrorCode) ? code as AiErrorCode : 'unavailable',
    typeof data.resetAt === 'string' ? data.resetAt : undefined,
    typeof data.premium === 'boolean' ? data.premium : undefined);
}

async function readStream(response: Response, onDelta: (delta: string) => void): Promise<unknown> {
  if (!response.body) throw new AiError('unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: unknown;
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = frame.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
        const raw = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        const data = dataObject(JSON.parse(raw));
        if (event === 'delta' && typeof data.text === 'string') onDelta(data.text);
        if (event === 'done') { result = data.result; completed = true; }
        if (event === 'error') throw asError(data);
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!completed) throw new AiError('provider_error');
  return result;
}

export function createAiClient({ serverUrl, openModelBaseUrl, openModel, identify, fetcher = expoFetch as typeof fetch }: ClientOptions) {
  const base = serverUrl.replace(/\/$/, '');
  async function session(): Promise<Session> {
    if (!base.startsWith('https://') || base.endsWith('_PLACEHOLDER')) throw new AiError('unavailable');
    let value = savedSession.get();
    if (!value) {
      const response = await fetcher(`${base}/ai/session`, { method: 'POST' });
      if (!response.ok) throw asError(await response.json());
      value = sessionSchema.parse(await response.json());
      savedSession.set(value);
    }
    await identify?.(value.userId);
    return value;
  }

  async function generate(task: AiTask, input: string, onDelta?: (delta: string) => void): Promise<unknown> {
    const text = inputSchema.safeParse(input);
    if (!text.success) throw new AiError(input.length > 32_000 ? 'too_long' : 'invalid_request');
    const current = await session();
    const response = await fetcher(`${base}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` },
      body: JSON.stringify({
        task, input: text.data, stream: onDelta !== undefined, openModelBaseUrl, openModel,
      }),
    });
    if (response.status === 401) {
      savedSession.set(null);
      throw new AiError('unauthorized');
    }
    if (!response.ok) throw asError(await response.json());
    return onDelta ? await readStream(response, onDelta) : dataObject(await response.json()).result;
  }

  async function post(path: 'transcribe' | 'split', body: BodyInit, contentType?: string): Promise<unknown> {
    const current = await session();
    const headers = new Headers({ Authorization: `Bearer ${current.token}` });
    if (contentType) headers.set('Content-Type', contentType);
    const response = await fetcher(`${base}/ai/${path}`, { method: 'POST', headers, body });
    if (response.status === 401) {
      savedSession.set(null);
      throw new AiError('unauthorized');
    }
    if (!response.ok) throw asError(await response.json());
    return response.json();
  }

  return {
    async profile(input: string, onDelta?: (delta: string) => void): Promise<TeammateProfile> {
      return profileSchema.parse(await generate('profile', input, onDelta));
    },
    async answer(input: string, onDelta?: (delta: string) => void): Promise<string> {
      const result = await generate('answer', input, onDelta);
      if (typeof result !== 'string') throw new AiError('provider_error');
      return result;
    },
    async transcribe(audio: Blob): Promise<Transcription> {
      if (audio.size === 0 || audio.size > 25 * 1024 * 1024) throw new AiError(audio.size > 25 * 1024 * 1024 ? 'too_long' : 'invalid_request');
      const body = new FormData();
      body.append('audio', audio, 'dump-audio.m4a');
      const value = dataObject(await post('transcribe', body));
      if (typeof value.text !== 'string' || typeof value.language !== 'string') throw new AiError('provider_error');
      return { text: value.text, language: value.language };
    },
    async split(text: string, detectedLanguage?: string): Promise<DumpSplit> {
      const parsed = inputSchema.safeParse(text);
      if (!parsed.success) throw new AiError(text.length > 32_000 ? 'too_long' : 'invalid_request');
      return dumpSplitSchema.parse(await post('split', JSON.stringify({ text: parsed.data, detectedLanguage }), 'application/json'));
    },
  };
}
