import { useLocales, type Locale } from 'expo-localization';
import { createContext, use, useState, type ReactNode } from 'react';

import {
  directions,
  format,
  supportedLanguages,
  type Language,
  type Messages,
  type ParamsArg,
  type TextDirection,
  type TextSet,
} from './text.ts';

export type LanguageChoice = 'system' | Language;

type LanguageState = {
  language: Language;
  direction: TextDirection;
  choice: LanguageChoice;
  setChoice: (choice: LanguageChoice) => void;
};

const LanguageContext = createContext<LanguageState | null>(null);

// The choice is in memory until local storage (#6) persists it.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<LanguageChoice>('system');
  const locales = useLocales();
  const language = choice === 'system' ? deviceLanguage(locales) : choice;

  return (
    <LanguageContext value={{ language, direction: directions[language], choice, setChoice }}>
      {children}
    </LanguageContext>
  );
}

function isLanguage(code: string | null): code is Language {
  return supportedLanguages.some((language) => language === code);
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
