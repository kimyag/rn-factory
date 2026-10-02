export const supportedLanguages = ['en', 'tr'] as const;

export type Language = (typeof supportedLanguages)[number];
export type TextDirection = 'ltr' | 'rtl';

export const directions: Record<Language, TextDirection> = {
  en: 'ltr',
  tr: 'ltr',
};

export type PluralForms = { other: string } & Partial<
  Record<Exclude<Intl.LDMLPluralRule, 'other'>, string>
>;

type Message = string | PluralForms;

export type Messages = Record<string, Message>;

export type Translation<T extends Messages> = {
  [K in keyof T]: T[K] extends string ? string : PluralForms;
};

export type TextSet<T extends Messages> = { en: T } & {
  [L in Exclude<Language, 'en'>]: Translation<T>;
};

type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never;

type Value = string | number;

export type ParamsArg<M> = M extends PluralForms
  ? [params: { count: number } & Record<Exclude<Placeholders<M[keyof M]>, 'count'>, Value>]
  : [Placeholders<M>] extends [never]
    ? []
    : [params: Record<Placeholders<M>, Value>];

const numberFormats = new Map<Language, Intl.NumberFormat>();

function formatNumber(value: number, language: Language): string {
  const cached = numberFormats.get(language);
  const formatter = cached ?? new Intl.NumberFormat(language);
  if (!cached) {
    numberFormats.set(language, formatter);
  }
  return formatter.format(value);
}

function pluralForm(forms: PluralForms, language: Language, count: number): string {
  const category = new Intl.PluralRules(language).select(count);
  return forms[category] ?? forms.other;
}

export function format(
  message: Message,
  language: Language,
  params: Record<string, Value> = {},
): string {
  const count = params.count;
  const template =
    typeof message === 'string'
      ? message
      : pluralForm(message, language, typeof count === 'number' ? count : 0);

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      return match;
    }
    return typeof value === 'number' ? formatNumber(value, language) : value;
  });
}
