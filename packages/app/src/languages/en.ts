import type { LanguageDefinition } from './types.ts';

export const en: LanguageDefinition = {
  name: 'English',
  direction: 'ltr',
  plural: (count) => (count === 1 ? 'one' : 'other'),
};
