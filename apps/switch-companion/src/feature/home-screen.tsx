import { useText } from '@factory/app';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Button, createStyles, Mark, Screen, Text } from '@factory/ui';
import { forwardRef, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type ScrollViewProps, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { text } from '@/text';
import { createTaskStore, type Task } from './task-store.ts';

const tasks = createTaskStore();

export function HomeScreen() {
  const t = useText(text);
  const styles = useStyles();
  const state = useSyncExternalStore(tasks.subscribe, tasks.getSnapshot, tasks.getSnapshot);
  const [adding, setAdding] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const open = state.tasks.filter((task) => task.archivedAt === undefined);
  const [width, setWidth] = useState(0);

  function act(action: () => void) {
    try {
      action();
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <Screen>
      <View testID="feature-home" style={styles.content}>
        {adding ? (
          <AddTask
            onCancel={() => setAdding(false)}
            onSave={(title) => act(() => {
              tasks.addTask(title, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, Date.now());
              setAdding(false);
            })}
          />
        ) : (
          <>
            <View style={styles.pager} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
              {open.length === 0 ? (
                <View style={styles.empty}><Text testID="tasks-empty">{t('tasks.empty')}</Text></View>
              ) : width > 0 && (
                <TaskPager
                  key={`${width}:${open.map((task) => task.id).join(':')}`}
                  items={open}
                  currentId={state.currentTaskId}
                  width={width}
                  onSelect={(id) => act(() => tasks.selectTask(id))}
                />
              )}
            </View>
            <Button testID="task-add" title={t('tasks.add')} onPress={() => setAdding(true)} />
            {state.currentTaskId && (
              <Button testID="task-archive" variant="secondary" title={t('tasks.archive')} onPress={() => act(() => {
                const id = state.currentTaskId;
                if (!id) return;
                tasks.archiveTask(id, Date.now());
                setUndoId(id);
              })} />
            )}
            {undoId && (
              <View style={styles.undo}>
                <Text variant="caption" accessibilityLiveRegion="polite">{t('tasks.archived')}</Text>
                <Button testID="task-undo" variant="secondary" title={t('tasks.undo')} onPress={() => act(() => {
                  tasks.undoArchive(undoId);
                  setUndoId(null);
                })} />
              </View>
            )}
          </>
        )}
        {error && <Text accessibilityRole="alert">{t('tasks.saveError')}</Text>}
      </View>
    </Screen>
  );
}

function AddTask({ onSave, onCancel }: { onSave: (title: string) => void; onCancel: () => void }) {
  const t = useText(text);
  const styles = useStyles();
  const [title, setTitle] = useState('');
  const trimmed = title.trim();
  return (
    <KeyboardAvoidingView style={styles.editor} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text variant="title">{t('tasks.add')}</Text>
      <TextInput
        testID="task-title-input"
        accessibilityLabel={t('tasks.title')}
        placeholder={t('tasks.title')}
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
        autoFocus
        value={title}
        onChangeText={setTitle}
        returnKeyType="done"
        onSubmitEditing={() => { if (trimmed) onSave(trimmed); }}
      />
      <Button testID="task-save" title={t('tasks.save')} disabled={!trimmed} onPress={() => onSave(trimmed)} />
      <Button testID="task-cancel" variant="secondary" title={t('tasks.cancel')} onPress={onCancel} />
    </KeyboardAvoidingView>
  );
}

// FlashList's scroll view participates in Gesture Handler's native UI-thread paging.
const PagerScroll = forwardRef<ScrollView, ScrollViewProps>(function PagerScroll(props, ref) {
  const gesture = Gesture.Native();
  return <GestureDetector gesture={gesture}><ScrollView {...props} ref={ref} /></GestureDetector>;
});

function TaskPager({ items, currentId, width, onSelect }: {
  items: Task[]; currentId: string | null; width: number; onSelect: (id: string) => void;
}) {
  const t = useText(text);
  const styles = useStyles();
  const list = useRef<FlashListRef<Task>>(null);
  const reducedMotion = useReducedMotion();
  const index = Math.max(0, items.findIndex((task) => task.id === currentId));
  const [height, setHeight] = useState(0);
  const visibleIndex = useRef(index);
  const pendingIndex = useRef<number | null>(null);
  const swiping = useRef(false);

  useEffect(() => {
    if (height <= 0 || !list.current || (index === visibleIndex.current && pendingIndex.current === null) || index === pendingIndex.current) return;
    pendingIndex.current = index;
    swiping.current = false;
    list.current.scrollToIndex({ index, animated: !reducedMotion });
    if (reducedMotion) {
      visibleIndex.current = index;
      pendingIndex.current = null;
    }
  }, [index, height, reducedMotion]);

  function finish(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    const task = items[next];
    if (!task || (pendingIndex.current !== null && next !== pendingIndex.current)) return;
    visibleIndex.current = next;
    pendingIndex.current = null;
    const userSwipe = swiping.current;
    swiping.current = false;
    if (userSwipe && task.id !== currentId) onSelect(task.id);
  }

  function move(next: number) {
    const task = items[next];
    if (!task) return;
    onSelect(task.id);
  }

  return (
    <View style={styles.content}>
      <View style={styles.pager} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {height > 0 && (
          <FlashList
            ref={list}
            style={{ height }}
            testID="task-pager"
            data={items}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            maintainVisibleContentPosition={{ disabled: true }}
            keyExtractor={(task) => task.id}
            renderScrollComponent={PagerScroll}
            renderItem={({ item }) => <TaskCard task={item} width={width} height={height} selected={item.id === currentId} />}
            extraData={currentId}
            onScrollBeginDrag={() => {
              swiping.current = true;
              pendingIndex.current = null;
            }}
            onScrollEndDrag={(event) => {
              if (event.nativeEvent.velocity?.x === 0) finish(event);
            }}
            onMomentumScrollEnd={finish}
          />
        )}
      </View>
      <Text testID="task-position" variant="mono" accessibilityLiveRegion="polite">
        {t('tasks.position', { current: index + 1, total: items.length })}
      </Text>
      <View style={styles.navigation}>
        <Button testID="task-previous" variant="secondary" title={t('tasks.previous')} disabled={index === 0} onPress={() => move(index - 1)} />
        <Button testID="task-next" variant="secondary" title={t('tasks.next')} disabled={index === items.length - 1} onPress={() => move(index + 1)} />
      </View>
    </View>
  );
}

function TaskCard({ task, width, height, selected }: { task: Task; width: number; height: number; selected: boolean }) {
  const t = useText(text);
  const styles = useStyles();
  return (
    <View style={[styles.card, { width, height }]} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}>
      <View style={styles.cardHeader}>
        <Mark state={selected ? 'active' : 'empty'} />
        <Text variant="caption">{t('tasks.current')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.cardBody}>
        <Text testID={selected ? 'task-current-title' : undefined} variant="title">{task.title}</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  content: { flex: 1, gap: theme.spacing.gapWide },
  pager: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center' },
  editor: { flex: 1, gap: theme.spacing.gapWide },
  input: {
    ...theme.type.body, color: theme.colors.ink, borderWidth: 1, borderColor: theme.colors.ink,
    borderRadius: theme.radius.corner, padding: theme.spacing.gapWide,
  },
  placeholder: { color: theme.colors.inkMuted },
  card: { padding: theme.spacing.edge, borderWidth: 1, borderColor: theme.colors.ink, borderRadius: theme.radius.corner },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gap },
  cardBody: { paddingTop: theme.spacing.edge },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.gap },
  undo: { gap: theme.spacing.gap },
}));
