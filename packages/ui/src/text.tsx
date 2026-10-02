import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { createStyles } from './create-styles.ts';

export type TextVariant = 'title' | 'body' | 'caption' | 'mono';

type TextProps = NativeTextProps & { variant?: TextVariant };

export function Text({ variant = 'body', style, ...props }: TextProps) {
  const styles = useStyles();

  return (
    <NativeText
      accessibilityRole={variant === 'title' ? 'header' : undefined}
      {...props}
      style={[styles[variant], style]}
    />
  );
}

const useStyles = createStyles((theme) => ({
  title: { ...theme.type.title, color: theme.colors.ink },
  body: { ...theme.type.body, color: theme.colors.ink },
  caption: { ...theme.type.caption, color: theme.colors.inkMuted },
  mono: { ...theme.type.mono, color: theme.colors.ink },
}));
