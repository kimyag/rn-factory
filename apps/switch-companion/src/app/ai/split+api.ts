import { handleSplit } from '@factory/ai/server';
import settings from '../../../app.settings.ts';

export function POST(request: Request): Promise<Response> {
  return handleSplit(request, { ...process.env, APP_SLUG: settings.slug }, fetch, settings.ai.dailyLimits);
}
