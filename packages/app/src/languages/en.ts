import type { LanguageDefinition } from './types.ts';

export const en: LanguageDefinition = {
  direction: 'ltr',
  plural: (count) => (count === 1 ? 'one' : 'other'),
};
