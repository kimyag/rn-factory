import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { Flow } from './maestro-lib.ts';

function copyMissing(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    const from = join(source, name);
    const to = join(destination, name);
    if (!existsSync(to)) {
      cpSync(from, to, { recursive: true });
    } else if (statSync(from).isDirectory() && statSync(to).isDirectory()) {
      copyMissing(from, to);
    }
  }
}

export function preparePreviewFlow(
  flow: Flow,
  sharedFlowsDir: string,
  appFlowsDir: string,
  outputDir: string,
): Flow {
  cpSync(sharedFlowsDir, outputDir, { recursive: true });
  const isAppFlow = flow.file.startsWith(`${appFlowsDir}/`);
  if (isAppFlow) {
    copyMissing(appFlowsDir, outputDir);
  }

  const source = readFileSync(flow.file, 'utf8');
  const preview = source.replace(/^- runFlow: subflows\/start\.yaml\s*$/gm, '- runFlow: subflows/preview-start.yaml');
  if (preview === source && /DEV_CLIENT_LINK|SERVER_URL/.test(source)) {
    throw new Error(`${flow.name} uses dev-server values without the shared start subflow; it cannot run against a preview build.`);
  }

  const file = join(outputDir, basename(flow.file));
  writeFileSync(file, preview);
  return { ...flow, file };
}
