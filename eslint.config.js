// https://docs.expo.dev/guides/using-eslint/
import { createRequire } from 'node:module';

import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

const fromApp = createRequire(new URL('./apps/template-app/package.json', import.meta.url));
const reactVersion = fromApp('react/package.json').version;

export default defineConfig([
  expoConfig,
  {
    ignores: ['**/dist/*'],
  },
  {
    settings: { react: { version: reactVersion } },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
]);
