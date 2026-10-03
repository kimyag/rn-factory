export type TextDirection = 'ltr' | 'rtl';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export type LanguageDefinition = {
  name: string;
  direction: TextDirection;
  plural: (count: number) => PluralCategory;
};
