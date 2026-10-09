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

export function prepareFlow(
  flow: Flow,
  sharedFlowsDir: string,
  appFlowsDir: string,
  outputDir: string,
  previewBuild: boolean,
  paymentsAvailable?: boolean,
): Flow {
  cpSync(sharedFlowsDir, outputDir, { recursive: true });
  const isAppFlow = flow.file.startsWith(`${appFlowsDir}/`);
  if (isAppFlow) {
    copyMissing(appFlowsDir, outputDir);
  }

  const source = readFileSync(flow.file, 'utf8');
  let prepared = source;
  if (flow.name === 'settings' && paymentsAvailable !== undefined) {
    const paymentCheck = paymentsAvailable
      ? 'subflows/settings-payments-active.yaml'
      : 'subflows/settings-payments-inactive.yaml';
    prepared = prepared.replace('- runFlow: subflows/settings-payments-check.yaml', `- runFlow: ${paymentCheck}`);
  }
  if (flow.name === 'settings' && prepared === source && source.includes('settings-payments-check.yaml')) {
    throw new Error('Settings flow needs payment availability to select its payment assertions.');
  }
  const configured = previewBuild
    ? prepared.replace(/^- runFlow: subflows\/start\.yaml\s*$/gm, '- runFlow: subflows/preview-start.yaml')
    : prepared;
  if (previewBuild && configured === source && /DEV_CLIENT_LINK|SERVER_URL/.test(source)) {
    throw new Error(`${flow.name} uses dev-server values without the shared start subflow; it cannot run against a preview build.`);
  }

  const file = join(outputDir, basename(flow.file));
  writeFileSync(file, configured);
  return { ...flow, file };
}

export function preparePreviewFlow(
  flow: Flow,
  sharedFlowsDir: string,
  appFlowsDir: string,
  outputDir: string,
  paymentsAvailable?: boolean,
): Flow {
  return prepareFlow(flow, sharedFlowsDir, appFlowsDir, outputDir, true, paymentsAvailable);
}

export function preparePerformanceFlow(
  flow: Flow,
  sharedFlowsDir: string,
  appFlowsDir: string,
  outputDir: string,
): Flow {
  return preparePreviewFlow(flow, sharedFlowsDir, appFlowsDir, outputDir, false);
}
