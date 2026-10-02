export const spacing = {
  unit: 4,
  gap: 8,
  gapWide: 12,
  edge: 16,
} as const;

export const radius = {
  corner: 2,
  chamfer: 7,
} as const;

export const typeScale = {
  title: { fontSize: 28, lineHeight: 34 },
  body: { fontSize: 17, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  mono: { fontSize: 13, lineHeight: 18 },
} as const;

export const motion = {
  fade: 150,
  achieve: 400,
  orbit: 1200,
  pressedOpacity: 0.7,
  disabledOpacity: 0.4,
} as const;

export const mark = {
  size: 20,
  ring: 2,
  dot: 6,
  orbit: 4,
} as const;
