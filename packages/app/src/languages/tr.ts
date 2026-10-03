import type { LanguageDefinition } from './types.ts';

export const tr: LanguageDefinition = {
  name: 'Türkçe',
  direction: 'ltr',
  plural: (count) => (count === 1 ? 'one' : 'other'),
};
