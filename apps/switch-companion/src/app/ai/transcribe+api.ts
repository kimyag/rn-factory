import { handleTranscribe } from '@factory/ai/server';
import settings from '../../../app.settings.ts';

export function POST(request: Request): Promise<Response> {
  return handleTranscribe(request, { ...process.env, APP_SLUG: settings.slug }, fetch, settings.ai.dailyLimits);
}
