import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { createStyles } from './create-styles.ts';
import { useTheme } from './theme-provider.tsx';

export type MarkState = 'empty' | 'active' | 'complete' | 'loading';

type MarkProps = {
  state: MarkState;
  accessibilityLabel?: string;
};

export function Mark({ state, accessibilityLabel }: MarkProps) {
  const theme = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const { size, ring, dot, orbit } = theme.mark;
  const center = size / 2;
  const loading = state === 'loading';
  const complete = state === 'complete';
  const orbiting = loading && !reduceMotion;
  const color = state === 'empty' ? theme.colors.inkMuted : theme.colors.ink;

  const rotation = useSharedValue(0);
  useEffect(() => {
    if (!orbiting) {
      return;
    }
    rotation.set(
      withRepeat(withTiming(360, { duration: theme.motion.orbit, easing: Easing.linear }), -1),
    );
    return () => {
      cancelAnimation(rotation);
      rotation.set(0);
    };
  }, [orbiting, rotation, theme.motion.orbit]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  const fill = useAnimatedStyle(() => ({
    opacity: withTiming(complete ? 1 : 0, {
      duration: theme.motion.achieve,
      easing: Easing.out(Easing.ease),
    }),
  }));

  return (
    <View
      style={styles.mark}
      accessible={accessibilityLabel !== undefined || loading}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={loading ? 'progressbar' : undefined}
      accessibilityState={loading ? { busy: true } : undefined}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={center - ring / 2} stroke={color} strokeWidth={ring} fill="none" />
        {!loading && <Circle cx={center} cy={center} r={dot / 2} fill={color} />}
      </Svg>
      {loading && (
        <Animated.View style={[StyleSheet.absoluteFill, spin]}>
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center - orbit} r={dot / 2} fill={color} />
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, fill]} pointerEvents="none">
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={center} fill={theme.colors.achievement} />
          <Circle cx={center} cy={center} r={dot / 2} fill={theme.colors.onAchievement} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  mark: { width: theme.mark.size, height: theme.mark.size },
}));
