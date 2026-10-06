import { handleGenerate } from '@factory/ai/server';

export function POST(request: Request): Promise<Response> {
  return handleGenerate(request);
}
