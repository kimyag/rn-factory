import { useText } from '@factory/app';
import { FlashList } from '@shopify/flash-list';
import { Button, createStyles, Mark, Screen, Text, useAchievementDuration } from '@factory/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { text } from '@/text';
import { looseEndListItems, type LooseEndListItem } from './loose-ends.ts';
import { SwipeLooseEndRow } from './swipe-loose-end-row.tsx';
import { taskStore as tasks, type LooseEnd } from './task-store.ts';

type UndoAction = {
  actionId: string;
  end: LooseEnd;
  previous: { status: LooseEnd['status']; updatedAt: number };
};
type ScreenItem = LooseEndListItem | { kind: 'undo'; action: UndoAction } | { kind: 'empty'; id: 'empty' };

export function LooseEndsScreen() {
  const t = useText(text);
  const achievementDuration = useAchievementDuration();
  const styles = useStyles();
  const snapshot = useSyncExternalStore(tasks.subscribe, tasks.getSnapshot, tasks.getSnapshot);
  const [undoActions, setUndoActions] = useState<UndoAction[]>([]);
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState(false);
  const timers = useRef(new Map<string, { undo: ReturnType<typeof setTimeout>; complete?: ReturnType<typeof setTimeout> }>());
  const scrollGesture = Gesture.Native();

  useEffect(() => () => {
    for (const timer of timers.current.values()) {
      clearTimeout(timer.undo);
      if (timer.complete) clearTimeout(timer.complete);
    }
    timers.current.clear();
  }, []);

  function removeUndo(actionId: string) {
    const timer = timers.current.get(actionId);
    if (timer) {
      clearTimeout(timer.undo);
      if (timer.complete) clearTimeout(timer.complete);
      timers.current.delete(actionId);
    }
    setUndoActions((current) => current.filter((action) => action.actionId !== actionId));
  }

  function changeStatus(endId: string, status: 'done' | 'later') {
    try {
      const end = tasks.getSnapshot().looseEnds.find((item) => item.id === endId);
      if (!end) return;
      if (status === 'done') setCompletingIds((current) => current.includes(endId) ? current : [...current, endId]);
      const previous = tasks.setLooseEndStatus(endId, status, Date.now());
      if (!previous) {
        if (status === 'done') setCompletingIds((current) => current.filter((id) => id !== endId));
        return;
      }
      const actionId = `${endId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const action = { actionId, end, previous };
      setUndoActions((current) => [...current, action]);
      const undo = setTimeout(() => {
        timers.current.delete(actionId);
        setUndoActions((current) => current.filter((entry) => entry.actionId !== actionId));
      }, 5_000);
      const complete = status === 'done'
        ? setTimeout(() => setCompletingIds((current) => current.filter((id) => id !== endId)), achievementDuration)
        : undefined;
      timers.current.set(actionId, { undo, complete });
      setSaveError(false);
    } catch {
      if (status === 'done') setCompletingIds((current) => current.filter((id) => id !== endId));
      setSaveError(true);
    }
  }

  function undo(action: UndoAction) {
    try {
      tasks.restoreLooseEndStatus(action.end.id, action.previous);
      setCompletingIds((current) => current.filter((id) => id !== action.end.id));
      removeUndo(action.actionId);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  const content = looseEndListItems(snapshot.tasks, snapshot.looseEnds, completingIds);
  const data: ScreenItem[] = [
    ...undoActions.map((action) => ({ kind: 'undo' as const, action })),
    ...(content.length ? content : [{ kind: 'empty' as const, id: 'empty' as const }]),
  ];

  return (
    <Screen style={styles.screen}>
      <GestureDetector gesture={scrollGesture}>
        <FlashList
          testID="loose-ends-list"
          data={data}
          keyExtractor={(item) => item.kind === 'item' ? item.end.id : item.kind === 'undo' ? `undo:${item.action.actionId}` : item.id}
          getItemType={(item) => item.kind}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            if (item.kind === 'empty') {
              return (
                <View testID="loose-ends-empty" style={styles.empty}>
                  <Mark state="complete" accessibilityLabel={t('looseEnds.done')} />
                  <Text>{t('looseEnds.empty')}</Text>
                </View>
              );
            }
            if (item.kind === 'task' || item.kind === 'later') {
              return <Text testID={`loose-ends-section-${item.id}`} variant="title" style={styles.section}>{item.kind === 'later' ? t('looseEnds.laterSection') : item.title}</Text>;
            }
            if (item.kind === 'undo') {
              return (
                <View testID={`loose-ends-undo-row-${item.action.end.id}`} style={styles.undoRow}>
                  <Text style={styles.undoText}>{item.action.end.text}</Text>
                  <Button testID={`loose-ends-undo-${item.action.end.id}`} variant="secondary" title={t('looseEnds.undo')} onPress={() => undo(item.action)} />
                </View>
              );
            }
            return (
              <SwipeLooseEndRow
                item={item.end}
                taskTitle={item.taskTitle}
                scrollGesture={scrollGesture}
                complete={item.complete}
                testID={`loose-ends-row-${item.end.id}`}
                onStatusChange={changeStatus}
              />
            );
          }}
          extraData={{ undoActions, completingIds, saveError }}
        />
      </GestureDetector>
      {saveError && <Text accessibilityRole="alert">{t('looseEnds.saveError')}</Text>}
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  screen: { paddingTop: 0 },
  listContent: { flexGrow: 1, direction: 'ltr' },
  separator: { height: 1, backgroundColor: theme.colors.line },
  section: { paddingTop: theme.spacing.gapWide, paddingBottom: theme.spacing.gap, paddingHorizontal: theme.spacing.gap, direction: 'ltr' },
  empty: { flex: 1, minHeight: 160, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.gapWide },
  undoRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.gapWide, paddingHorizontal: theme.spacing.gap },
  undoText: { ...theme.type.caption, color: theme.colors.inkMuted, flex: 1 },
}));
