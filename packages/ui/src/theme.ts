import { neutrals, type AppSettings, type ColorScheme, type FontRole } from '@factory/core';
import type { TextStyle } from 'react-native';

import { mark, motion, radius, spacing, typeScale } from './tokens.ts';

export type ThemeSettings = Pick<AppSettings, 'appColor' | 'fonts'>;

function fontStyle(role: FontRole, systemWeight: TextStyle['fontWeight']): TextStyle {
  return role === 'system' ? { fontWeight: systemWeight } : { fontFamily: role.family };
}

function createTheme(settings: ThemeSettings, scheme: ColorScheme) {
  const palette = neutrals[scheme];
  return {
    scheme,
    colors: {
      ...palette,
      achievement: settings.appColor[scheme],
      onAchievement: palette.paper,
    },
    spacing,
    radius,
    motion,
    mark,
    type: {
      title: { ...typeScale.title, ...fontStyle(settings.fonts.title, '600') },
      body: typeScale.body,
      caption: typeScale.caption,
      mono: { ...typeScale.mono, ...fontStyle(settings.fonts.mono, '400') },
    },
  };
}

export type Theme = ReturnType<typeof createTheme>;

const themes = new WeakMap<ThemeSettings, Partial<Record<ColorScheme, Theme>>>();

export function getTheme(settings: ThemeSettings, scheme: ColorScheme): Theme {
  const cached = themes.get(settings);
  const existing = cached?.[scheme];
  if (existing) {
    return existing;
  }
  const theme = createTheme(settings, scheme);
  themes.set(settings, { ...cached, [scheme]: theme });
  return theme;
}
