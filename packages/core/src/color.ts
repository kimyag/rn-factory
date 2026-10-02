export const neutrals = {
  light: { paper: '#F7F6F2', ink: '#0E0E10', inkMuted: '#6B675F', line: '#DDD9D0' },
  dark: { paper: '#0E0E10', ink: '#F2F1EC', inkMuted: '#9E9A92', line: '#2C2B28' },
} as const;

export type ColorScheme = keyof typeof neutrals;

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
