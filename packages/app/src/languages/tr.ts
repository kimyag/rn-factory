import type { LanguageDefinition } from './types.ts';

export const tr: LanguageDefinition = {
  direction: 'ltr',
  plural: (count) => (count === 1 ? 'one' : 'other'),
};
