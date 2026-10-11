import { useText } from '@factory/app';
import { createStyles, Mark, Text, useTheme } from '@factory/ui';
import { View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { text } from '@/text';
import type { LooseEnd } from './task-store.ts';

export function SwipeLooseEndRow({ item, taskTitle, scrollGesture, onStatusChange, complete = false, testID }: {
  item: LooseEnd;
  taskTitle: string;
  scrollGesture: GestureType;
  onStatusChange: (id: string, status: 'done' | 'later') => void;
  complete?: boolean;
  testID?: string;
}) {
  const t = useText(text);
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const gesture = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .simultaneousWithExternalGesture(scrollGesture)
    .onUpdate((event) => offset.set(event.translationX))
    .onEnd((event) => {
      if (event.translationX > 100) {
        scheduleOnRN(onStatusChange, item.id, 'done');
      } else if (event.translationX < -100) {
        scheduleOnRN(onStatusChange, item.id, 'later');
      }
    })
    .onFinalize(() => offset.set(withTiming(0, {
      duration: reducedMotion ? 0 : theme.motion.fade,
      reduceMotion: ReduceMotion.System,
    })));
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  function accessibilityAction(actionName: string) {
    if (actionName === 'done') onStatusChange(item.id, 'done');
    if (actionName === 'later') onStatusChange(item.id, 'later');
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={testID}
        style={[styles.row, animated]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${item.text}, ${taskTitle}`}
        accessibilityHint={t('looseEnds.swipeHint')}
        accessibilityActions={[
          { name: 'done', label: t('looseEnds.done') },
          { name: 'later', label: t('looseEnds.later') },
        ]}
        onAccessibilityAction={(event) => accessibilityAction(event.nativeEvent.actionName)}
      >
        <Mark testID={complete ? 'loose-ends-complete-mark' : undefined} state={complete ? 'complete' : 'empty'} accessibilityLabel={complete ? t('looseEnds.done') : undefined} />
        <View style={styles.text}>
          <Text testID={testID ? `${testID}-text` : undefined} style={styles.itemText}>{item.text}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const useStyles = createStyles((theme) => ({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gapWide, paddingVertical: theme.spacing.gap, paddingHorizontal: theme.spacing.gap, direction: 'ltr' },
  text: { flex: 1, gap: theme.spacing.gap, direction: 'ltr' },
  itemText: { writingDirection: 'auto' },
}));
