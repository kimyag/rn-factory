import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from './create-styles.ts';
import { useTheme } from './theme-provider.tsx';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = false, style }: ScreenProps) {
  const styles = useStyles();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const safeArea = {
    paddingBottom: spacing.edge + insets.bottom,
    paddingLeft: spacing.edge + insets.left,
    paddingRight: spacing.edge + insets.right,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, safeArea, style]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, styles.content, safeArea, style]}>{children}</View>;
}

const useStyles = createStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.paper },
  content: { paddingTop: theme.spacing.edge, gap: theme.spacing.gap },
}));
