import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type LayoutRectangle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { createStyles } from './create-styles.ts';
import { useTheme } from './theme-provider.tsx';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  selected = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);
  const pressed = useSharedValue(false);
  const restOpacity = disabled ? theme.motion.disabledOpacity : 1;
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(pressed.get() ? theme.motion.pressedOpacity : restOpacity, {
      duration: theme.motion.fade,
      easing: Easing.out(Easing.ease),
    }),
  }));
  const primary = variant === 'primary';

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => pressed.set(true)}
      onPressOut={() => pressed.set(false)}
      onLayout={primary ? (event) => setLayout(event.nativeEvent.layout) : undefined}
      style={[styles.button, !primary && styles.secondary, fade, style]}
    >
      {primary && <Chamfer layout={layout} color={theme.colors.ink} cut={theme.radius.chamfer} />}
      <NativeText style={primary ? styles.primaryLabel : styles.secondaryLabel}>{title}</NativeText>
    </AnimatedPressable>
  );
}

function Chamfer({ layout, color, cut }: { layout: LayoutRectangle | null; color: string; cut: number }) {
  if (!layout) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />;
  }
  const { width, height } = layout;
  const points = [
    `${cut},0`,
    `${width - cut},0`,
    `${width},${cut}`,
    `${width},${height - cut}`,
    `${width - cut},${height}`,
    `${cut},${height}`,
    `0,${height - cut}`,
    `0,${cut}`,
  ].join(' ');

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Polygon points={points} fill={color} />
    </Svg>
  );
}

const useStyles = createStyles((theme) => ({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.edge,
    paddingVertical: theme.spacing.gapWide,
  },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.corner,
    paddingHorizontal: theme.spacing.edge - 1,
    paddingVertical: theme.spacing.gapWide - 1,
  },
  primaryLabel: { ...theme.type.body, fontWeight: '600', color: theme.colors.paper },
  secondaryLabel: { ...theme.type.body, fontWeight: '600', color: theme.colors.ink },
}));
