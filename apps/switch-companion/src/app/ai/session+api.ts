import { handleSession } from '@factory/ai/server';
import settings from '../../../app.settings.ts';

export function POST(request: Request): Promise<Response> {
  return handleSession(request, { ...process.env, APP_SLUG: settings.slug });
}
