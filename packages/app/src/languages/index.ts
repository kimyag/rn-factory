import { en } from './en.ts';
import { tr } from './tr.ts';

export const languages = { en, tr };

export type Language = keyof typeof languages;

export function isLanguage(code: string | null): code is Language {
  return code !== null && Object.hasOwn(languages, code);
}

export type { LanguageDefinition, PluralCategory, TextDirection } from './types.ts';
