import { handleSession } from '@factory/ai/server';

export function POST(request: Request): Promise<Response> {
  return handleSession(request);
}
