// Pure parts of `pnpm maestro`: read the options, find the flows, build the commands.
// Nothing here talks to the device, the network, or the file system except flowsIn.
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

export type Options = {
  app: string;
  lang: string;
  theme: string;
  server: string | null;
  names: string[];
};

const themes = ['system', 'light', 'dark'];

export function parseArgs(args: string[]): Options {
  const options: Options = { app: 'template-app', lang: 'en', theme: 'dark', server: null, names: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    if (arg === '--app' || arg === '--lang' || arg === '--theme' || arg === '--server') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${arg} needs a value`);
      }
      i += 1;
      if (arg === '--server') {
        options.server = value.replace(/\/+$/, '');
      } else {
        options[arg.slice(2) as 'app' | 'lang' | 'theme'] = value;
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}. Options: --app, --lang, --theme, --server`);
    } else {
      options.names.push(arg);
    }
  }
  if (!themes.includes(options.theme)) {
    throw new Error(`--theme must be one of ${themes.join(', ')}`);
  }
  return options;
}

export type Flow = { name: string; file: string };

// Shared flows live in maestro/; an app's own feature flows in apps/<app>/.maestro/.
export function flowsIn(folder: string): Flow[] {
  if (!existsSync(folder)) {
    return [];
  }
  return readdirSync(folder)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .map((file) => ({ name: basename(file, '.yaml'), file: join(folder, file) }));
}

export function selectFlows(available: Flow[], names: string[]): Flow[] {
  if (names.length === 0) {
    return available;
  }
  return names.map((name) => {
    const flow = available.find((item) => item.name === name);
    if (!flow) {
      throw new Error(`No flow named ${name}. Flows: ${available.map((item) => item.name).join(', ')}`);
    }
    return flow;
  });
}

export function devClientLink(slug: string, server: string): string {
  return `exp+${slug}://expo-development-client/?url=${encodeURIComponent(server)}`;
}

export function maestroArgs(
  flow: Flow,
  values: { appId: string; link: string; lang: string; theme: string },
): string[] {
  return [
    'test',
    '-e', `APP_ID=${values.appId}`,
    '-e', `DEV_CLIENT_LINK=${values.link}`,
    '-e', `LANG_CODE=${values.lang}`,
    '-e', `THEME=${values.theme}`,
    flow.file,
  ];
}

// Exactly one connected device: a second phone or an emulator would make Maestro pick one.
export function connectedDevices(adbOutput: string): string[] {
  return adbOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0] ?? '');
}
