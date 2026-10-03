import { storedValue } from '@factory/core/storage';
import { useLocales, type Locale } from 'expo-localization';
import { createContext, use, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { isLanguage, languages, type Language, type TextDirection } from './languages/index.ts';
import { format, type Messages, type ParamsArg, type TextSet } from './text.ts';

export type LanguageChoice = 'system' | Language;

type LanguageState = {
  language: Language;
  direction: TextDirection;
  choice: LanguageChoice;
  setChoice: (choice: LanguageChoice) => void;
};

const LanguageContext = createContext<LanguageState | null>(null);

const storedChoice = storedValue({
  key: 'language.choice',
  schema: z.custom<LanguageChoice>(
    (value) => value === 'system' || (typeof value === 'string' && isLanguage(value)),
  ),
  fallback: 'system',
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState(() => storedChoice.get());
  const locales = useLocales();
  const language = choice === 'system' ? deviceLanguage(locales) : choice;

  function setChoice(next: LanguageChoice) {
    storedChoice.set(next);
    setChoiceState(next);
  }

  return (
    <LanguageContext value={{ language, direction: languages[language].direction, choice, setChoice }}>
      {children}
    </LanguageContext>
  );
}

function deviceLanguage(locales: Locale[]): Language {
  const match = locales.find((locale) => isLanguage(locale.languageCode));
  return match && isLanguage(match.languageCode) ? match.languageCode : 'en';
}

export function useLanguage(): LanguageState {
  const state = use(LanguageContext);
  if (!state) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return state;
}

export function useText<T extends Messages>(text: TextSet<T>) {
  const { language } = useLanguage();
  const messages: Messages = text[language];

  return function t<K extends keyof T & string>(key: K, ...[params]: ParamsArg<T[K]>): string {
    return format(messages[key], language, params);
  };
}
