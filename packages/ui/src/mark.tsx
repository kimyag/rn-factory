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
import { useAchievementDuration } from './motion.ts';
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
  const achievementDuration = useAchievementDuration();
  const { size, dot, orbit } = theme.mark;
  const center = size / 2;
  const loading = state === 'loading';
  const complete = state === 'complete';
  const orbiting = loading && !reduceMotion;
  const inked = state !== 'empty';

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
  const ink = useAnimatedStyle(() => ({
    opacity: withTiming(inked ? 1 : 0, {
      duration: theme.motion.fade,
      easing: Easing.out(Easing.ease),
    }),
  }));
  const fill = useAnimatedStyle(() => ({
    opacity: withTiming(complete ? 1 : 0, {
      duration: achievementDuration,
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
      {loading ? (
        <>
          <Ring color={theme.colors.ink} withDot={false} />
          <Animated.View style={[StyleSheet.absoluteFill, spin]}>
            <Svg width={size} height={size}>
              <Circle cx={center} cy={center - orbit} r={dot / 2} fill={theme.colors.ink} />
            </Svg>
          </Animated.View>
        </>
      ) : (
        <>
          <Ring color={theme.colors.inkMuted} withDot />
          <Animated.View style={[StyleSheet.absoluteFill, ink]} pointerEvents="none">
            <Ring color={theme.colors.ink} withDot />
          </Animated.View>
        </>
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

function Ring({ color, withDot }: { color: string; withDot: boolean }) {
  const { size, ring, dot } = useTheme().mark;
  const center = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={center - ring / 2} stroke={color} strokeWidth={ring} fill="none" />
      {withDot && <Circle cx={center} cy={center} r={dot / 2} fill={color} />}
    </Svg>
  );
}

const useStyles = createStyles((theme) => ({
  mark: { width: theme.mark.size, height: theme.mark.size },
}));
