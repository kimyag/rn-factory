import { handleGenerate } from '@factory/ai/server';
import settings from '../../../app.settings.ts';

export function POST(request: Request): Promise<Response> {
  return handleGenerate(request, process.env, fetch, settings.ai.dailyLimits);
}
