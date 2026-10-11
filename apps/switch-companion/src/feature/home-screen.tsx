import { useText } from '@factory/app';
import { useAudioRecorder, AudioModule, RecordingPresets, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { useNetworkState } from 'expo-network';
import { useAi } from '@factory/ai';
import { Button, createStyles, Mark, Screen, Text, useAchievementDuration, useTheme } from '@factory/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, type FlatList as FlatListType, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { text } from '@/text';
import { closeThenProcessDump } from './dump-workflow.ts';
import { SwipeLooseEndRow } from './swipe-loose-end-row.tsx';
import { taskStore as tasks, type Dump, type LooseEnd, type Task } from './task-store.ts';

export function HomeScreen() {
  const t = useText(text);
  const ai = useAi();
  const network = useNetworkState();
  const styles = useStyles();
  const state = useSyncExternalStore(tasks.subscribe, tasks.getSnapshot, tasks.getSnapshot);
  const achievementDuration = useAchievementDuration();
  const [adding, setAdding] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [looseEndUndo, setLooseEndUndo] = useState<{ id: string; end: LooseEnd; previous: { status: LooseEnd['status']; updatedAt: number } }[]>([]);
  const [completingLooseEndIds, setCompletingLooseEndIds] = useState<string[]>([]);
  const looseEndTimers = useRef(new Map<string, { undo: ReturnType<typeof setTimeout>; complete?: ReturnType<typeof setTimeout> }>());
  const open = state.tasks.filter((task) => task.archivedAt === undefined);
  const [width, setWidth] = useState(0);

  useEffect(() => () => {
    for (const timer of looseEndTimers.current.values()) {
      clearTimeout(timer.undo);
      if (timer.complete) clearTimeout(timer.complete);
    }
    looseEndTimers.current.clear();
  }, []);

  function changeLooseEndStatus(endId: string, status: 'done' | 'later') {
    act(() => {
      const end = tasks.getSnapshot().looseEnds.find((item) => item.id === endId);
      if (!end) return;
      if (status === 'done') setCompletingLooseEndIds((current) => current.includes(endId) ? current : [...current, endId]);
      let previous: ReturnType<typeof tasks.setLooseEndStatus>;
      try {
        previous = tasks.setLooseEndStatus(endId, status, Date.now());
      } catch (error) {
        if (status === 'done') setCompletingLooseEndIds((current) => current.filter((id) => id !== endId));
        throw error;
      }
      if (!previous) {
        if (status === 'done') setCompletingLooseEndIds((current) => current.filter((id) => id !== endId));
        return;
      }
      const actionId = `${endId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      setLooseEndUndo((current) => [...current, { id: actionId, end, previous }]);
      const undo = setTimeout(() => {
        looseEndTimers.current.delete(actionId);
        setLooseEndUndo((current) => current.filter((action) => action.id !== actionId));
      }, 5_000);
      const complete = status === 'done'
        ? setTimeout(() => setCompletingLooseEndIds((current) => current.filter((id) => id !== endId)), achievementDuration)
        : undefined;
      looseEndTimers.current.set(actionId, { undo, complete });
    });
  }

  function undoLooseEnd(actionId: string) {
    const action = looseEndUndo.find((item) => item.id === actionId);
    if (!action) return;
    act(() => {
      tasks.restoreLooseEndStatus(action.end.id, action.previous);
      const timer = looseEndTimers.current.get(actionId);
      if (timer) {
        clearTimeout(timer.undo);
        if (timer.complete) clearTimeout(timer.complete);
        looseEndTimers.current.delete(actionId);
      }
      setCompletingLooseEndIds((current) => current.filter((id) => id !== action.end.id));
      setLooseEndUndo((current) => current.filter((item) => item.id !== actionId));
    });
  }

  function act(action: () => void) {
    try {
      action();
      setError(false);
    } catch {
      setError(true);
    }
  }

  function retryDump(dumpId: string) {
    const dump = tasks.getSnapshot().dumps.find((item) => item.id === dumpId);
    if (!dump || dump.aiStatus !== 'failed') return;
    tasks.retryDump(dumpId);
    void closeThenProcessDump(tasks, dumpId, () => {}, () => processDump(
      dumpId, ai, network.isConnected !== false && network.isInternetReachable !== false,
    ));
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
                  dumps={state.dumps}
                  looseEnds={state.looseEnds}
                  currentId={state.currentTaskId}
                  width={width}
                  onSelect={(id) => act(() => tasks.selectTask(id))}
                  onRetryDump={retryDump}
                  onLooseEndStatusChange={changeLooseEndStatus}
                  onUndoLooseEnd={undoLooseEnd}
                  looseEndUndo={looseEndUndo}
                  completingLooseEndIds={completingLooseEndIds}
                />
              )}
            </View>
            <Button testID="task-add" title={t('tasks.add')} onPress={() => setAdding(true)} />
            {state.currentTaskId && (
              <>
                <Button testID="task-leave" variant="secondary" title={t('leave.open')} onPress={() => setLeaving(true)} />
                <Button testID="task-archive" variant="secondary" title={t('tasks.archive')} onPress={() => act(() => {
                  const id = state.currentTaskId;
                  if (!id) return;
                  tasks.archiveTask(id, Date.now());
                  setUndoId(id);
                })} />
              </>
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
      {state.currentTaskId && (
        <LeaveSheet
          key={state.currentTaskId}
          visible={leaving}
          taskId={state.currentTaskId}
          onClose={() => setLeaving(false)}
          ai={ai}
          online={network.isConnected !== false && network.isInternetReachable !== false}
        />
      )}
    </Screen>
  );
}

type AiApi = ReturnType<typeof useAi>;

function LeaveSheet({ visible, taskId, onClose, ai, online }: { visible: boolean; taskId: string | null; onClose: () => void; ai: AiApi; online: boolean }) {
  const t = useText(text);
  const theme = useTheme();
  const styles = useStyles();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const activeDumpId = useRef<string | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});
  const nextDumpId = useRef(0);

  useEffect(() => {
    if (!recorderState.mediaServicesDidReset || !recording || !taskId || !activeDumpId.current) return;
    tasks.replacePendingAudio(activeDumpId.current, recorder.uri ?? undefined);
    tasks.failDump(activeDumpId.current, '');
    activeDumpId.current = null;
    setRecording(false);
    setError(t('leave.recordingFailed'));
  }, [recorderState.mediaServicesDidReset, recording, taskId, t, recorder]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active' && recording) void stopRecordingRef.current();
    });
    return () => subscription.remove();
  }, [recording]);

  function saveText() {
    if (!taskId || !draft.trim()) return;
    const textValue = draft.trim();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    try {
      tasks.createPendingDump({ id, taskId, createdAt: Date.now(), rawText: textValue, source: 'text', aiStatus: 'pending' });
      setDraft('');
      setError(null);
      void closeThenProcessDump(tasks, id, onClose, () => processDump(id, ai, online));
    } catch {
      setError(t('tasks.saveError'));
    }
  }

  function closeSheet() {
    if (recording) {
      void stopRecordingRef.current();
      return;
    }
    setError(null);
    onClose();
  }

  async function toggleRecording() {
    if (!taskId) return;
    if (recording) {
      await stopAndSaveRecording();
      return;
    }
    void startRecording();
  }

  async function startRecording() {
    if (!taskId) return;
    const createdAt = Date.now();
    const id = `${createdAt.toString(36)}-${(nextDumpId.current++).toString(36)}`;
    tasks.createPendingDump({ id, taskId, createdAt, rawText: '', source: 'voice', aiStatus: 'pending' });
    activeDumpId.current = id;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        tasks.failDump(id, '');
        activeDumpId.current = null;
        setError(t('leave.permission'));
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setError(null);
    } catch {
      tasks.failDump(id, '');
      activeDumpId.current = null;
      setError(t('leave.recordingFailed'));
    }
  }

  const stopAndSaveRecording = async () => {
    if (!taskId) return;
    const activeId = activeDumpId.current;
    const activeDump = activeId ? tasks.getSnapshot().dumps.find((dump) => dump.id === activeId) : undefined;
    if (!activeDump || activeDump.source !== 'voice' || activeDump.aiStatus !== 'pending') return;
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) throw new Error('recording unavailable');
      tasks.replacePendingAudio(activeDump.id, uri);
      activeDumpId.current = null;
      setError(null);
      void closeThenProcessDump(tasks, activeDump.id, onClose, () => processDump(activeDump.id, ai, online));
    } catch {
      tasks.failDump(activeDump.id, activeDump.rawText);
      activeDumpId.current = null;
      setRecording(false);
      setError(t('leave.recordingFailed'));
    }
  };
  useEffect(() => {
    stopRecordingRef.current = stopAndSaveRecording;
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}>
        <View style={styles.sheet}>
          <Text variant="title">{t('leave.title')}</Text>
          {error && <Text accessibilityRole="alert">{error}</Text>}
          <TextInput
            testID="leave-text"
            accessibilityLabel={t('leave.type')}
            placeholder={t('leave.placeholder')}
            placeholderTextColor={theme.colors.inkMuted}
            style={styles.input}
            multiline
            value={draft}
            onChangeText={setDraft}
          />
          <Button testID="leave-save" title={t('leave.save')} onPress={saveText} disabled={!draft.trim()} />
          <Button testID="leave-record" variant="secondary" title={recording ? t('leave.recording') : t('leave.recordTap')} onPress={() => void toggleRecording()} />
          {recording && <Button testID="leave-record-stop" title={t('leave.recordDone')} onPress={() => void toggleRecording()} />}
          {!recording && (
            <Button
              testID="leave-close"
              variant="secondary"
              title={draft.trim() ? t('leave.keepDraft') : t('tasks.cancel')}
              onPress={closeSheet}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

async function processDump(dumpId: string, ai: AiApi, online: boolean) {
  if (!online) throw new Error('offline');
  const dump = tasks.getSnapshot().dumps.find((item) => item.id === dumpId);
  if (!dump) return;
  let rawText = dump.rawText;
  let detectedLanguage = dump.detectedLanguage;
  const audio = dump.audioUri ? new File(dump.audioUri) : undefined;
  if (audio && !rawText) {
    const transcript = await ai.transcribe(audio);
    rawText = transcript.text;
    detectedLanguage = transcript.language;
    tasks.setDumpTranscript(dumpId, rawText, detectedLanguage);
  }
  await processSplit(ai, dumpId, rawText, detectedLanguage);
  if (audio) {
    try {
      await audio.delete();
    } catch {
      // A completed dump no longer needs its temporary audio file.
    }
  }
}

async function processSplit(ai: AiApi, dumpId: string, rawText: string, detectedLanguage?: string) {
  tasks.setDumpRawText(dumpId, rawText);
  const result = await ai.split(rawText, detectedLanguage);
  const snapshot = tasks.getSnapshot();
  const dump = snapshot.dumps.find((item) => item.id === dumpId);
  if (!dump || dump.aiStatus !== 'pending') return;
  const now = Date.now();
  tasks.finishDump(dumpId, {
    rawText, detectedLanguage,
    whereIWas: result.whereIWas, nextStep: result.nextStep,
    looseEnds: result.looseEnds.map((value) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      taskId: dump.taskId, dumpId, text: value, status: 'open', updatedAt: now,
    })),
  });
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

function TaskPager({ items, dumps, looseEnds, currentId, width, onSelect, onRetryDump, onLooseEndStatusChange, onUndoLooseEnd, looseEndUndo = [], completingLooseEndIds = [] }: {
  items: Task[]; dumps: Dump[]; looseEnds: LooseEnd[]; currentId: string | null; width: number;
  onSelect: (id: string) => void; onRetryDump: (id: string) => void;
  onLooseEndStatusChange: (id: string, status: 'done' | 'later') => void;
  onUndoLooseEnd: (id: string) => void;
  looseEndUndo?: { id: string; end: LooseEnd; previous: { status: LooseEnd['status']; updatedAt: number } }[];
  completingLooseEndIds?: string[];
}) {
  const t = useText(text);
  const styles = useStyles();
  const list = useRef<FlatListType<Task>>(null);
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
          <FlatList
            ref={list}
            style={{ height }}
            testID="task-pager"
            data={items}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
            keyExtractor={(task) => task.id}
            renderItem={({ item }) => {
              const taskDumps = dumps.filter((dump) => dump.taskId === item.id);
              const sortedIndex = taskDumps.reduce((latest, dump, dumpIndex) => dump.aiStatus === 'done' ? dumpIndex : latest, -1);
              const sortedDump = sortedIndex >= 0 ? taskDumps[sortedIndex] : undefined;
              const newerDumps = taskDumps.slice(sortedIndex + 1);
              return (
                <TaskCard
                  task={item}
                  width={width}
                  height={height}
                  selected={item.id === currentId}
                  pendingDump={newerDumps.filter((dump) => dump.aiStatus === 'pending').at(-1)}
                  failedDump={newerDumps.filter((dump) => dump.aiStatus === 'failed' && (dump.rawText.length > 0 || dump.audioUri !== undefined)).at(-1)}
                  sortedDump={sortedDump}
                  sortedLooseEnds={sortedDump ? looseEnds.filter((end) => end.dumpId === sortedDump.id && (end.status === 'open' || completingLooseEndIds.includes(end.id))) : []}
                  onRetryDump={onRetryDump}
                  onLooseEndStatusChange={onLooseEndStatusChange}
                  onUndoLooseEnd={onUndoLooseEnd}
                  looseEndUndo={looseEndUndo.filter((action) => action.end.taskId === item.id)}
                />
              );
            }}
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

function TaskCard({ task, width, height, selected, pendingDump, failedDump, sortedDump, sortedLooseEnds, onRetryDump, onLooseEndStatusChange, onUndoLooseEnd, looseEndUndo = [] }: {
  task: Task; width: number; height: number; selected: boolean;
  pendingDump?: Dump; failedDump?: Dump; sortedDump?: Dump; sortedLooseEnds: LooseEnd[]; onRetryDump: (id: string) => void;
  onLooseEndStatusChange: (id: string, status: 'done' | 'later') => void;
  onUndoLooseEnd: (id: string) => void;
  looseEndUndo?: { id: string; end: LooseEnd }[];
}) {
  const t = useText(text);
  const styles = useStyles();
  const [expandedOriginalDumpId, setExpandedOriginalDumpId] = useState<string | null>(null);
  const originalExpanded = sortedDump !== undefined && expandedOriginalDumpId === sortedDump.id;
  const scrollGesture = Gesture.Native();
  return (
    <View style={[styles.card, { width, height }]} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}>
      <View style={styles.cardHeader}>
        <Mark state={selected ? 'active' : 'empty'} />
        <Text variant="caption">{t('tasks.current')}</Text>
      </View>
      <GestureDetector gesture={scrollGesture}>
        <FlatList
          style={styles.cardContent}
          contentContainerStyle={styles.cardBody}
          data={sortedDump ? sortedLooseEnds : []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.looseEndSeparator} />}
          ListHeaderComponent={(
          <View style={styles.cardContentSections}>
            <Text testID={selected ? 'task-current-title' : undefined} variant="title">{task.title}</Text>
            {pendingDump && <Text testID="task-dump-pending" variant="caption">{t('leave.sorting')}</Text>}
            {failedDump && (
              <View style={styles.dumpState}>
                <Text testID="task-dump-not-sorted" variant="caption">{t('leave.notSorted')}</Text>
                <Text>{t('leave.sortFailed')}</Text>
                <Text testID="task-dump-raw-text" style={styles.dumpText}>{failedDump.rawText || t('leave.failedAudio')}</Text>
                <Button testID="task-dump-retry" variant="secondary" title={t('leave.retry')} onPress={() => onRetryDump(failedDump.id)} />
              </View>
            )}
            {sortedDump && (
              <>
                <View testID="task-dump-section-next-step" style={styles.returnSection}>
                  <Text variant="caption">{t('return.nextStep')}</Text>
                  <Text testID="task-dump-next-step" variant="title" style={styles.dumpText}>{sortedDump.nextStep}</Text>
                </View>
                <View testID="task-dump-section-where-i-was" style={styles.returnSection}>
                  <Text variant="caption">{t('return.whereIWas')}</Text>
                  <Text testID="task-dump-where-i-was" style={styles.dumpText}>{sortedDump.whereIWas}</Text>
                </View>
                <Text testID="task-dump-section-loose-ends" variant="caption">{t('return.looseEnds')}</Text>
              </>
            )}
          </View>
        )}
          renderItem={({ item, index }) => (
            <SwipeLooseEndRow
              item={item}
              taskTitle={task.title}
              scrollGesture={scrollGesture}
              complete={item.status === 'done'}
              testID={`task-dump-loose-end-${index}`}
              onStatusChange={onLooseEndStatusChange}
            />
          )}
          ListFooterComponent={sortedDump ? (
            <View style={styles.originalNote}>
              {looseEndUndo.map((action) => (
                <View key={action.id} style={styles.cardUndo}>
                  <Text style={styles.dumpText}>{action.end.text}</Text>
                  <Button testID={`task-dump-undo-${action.end.id}`} variant="secondary" title={t('looseEnds.undo')} onPress={() => onUndoLooseEnd(action.id)} />
                </View>
              ))}
              <Pressable
                testID="task-dump-original-toggle"
                accessibilityRole="button"
                accessibilityState={{ expanded: originalExpanded }}
                onPress={() => setExpandedOriginalDumpId(originalExpanded ? null : sortedDump.id)}
                style={styles.originalToggle}
              >
                <Text>{t('return.originalNote')}</Text>
              </Pressable>
              {originalExpanded && <Text testID="task-dump-original-text" style={styles.dumpText}>{sortedDump.rawText}</Text>}
            </View>
          ) : null}
        />
      </GestureDetector>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  content: { flex: 1, gap: theme.spacing.gapWide },
  pager: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center' },
  editor: { flex: 1, gap: theme.spacing.gapWide },
  sheetBackdrop: { justifyContent: 'flex-end', backgroundColor: `${theme.colors.ink}66` },
  sheet: { backgroundColor: theme.colors.paper, padding: theme.spacing.edge, gap: theme.spacing.gapWide, borderTopWidth: 1, borderColor: theme.colors.ink },
  input: {
    ...theme.type.body, color: theme.colors.ink, borderWidth: 1, borderColor: theme.colors.ink,
    borderRadius: theme.radius.corner, padding: theme.spacing.gapWide,
  },
  placeholder: { color: theme.colors.inkMuted },
  card: { padding: theme.spacing.edge, borderWidth: 1, borderColor: theme.colors.ink, borderRadius: theme.radius.corner, direction: 'ltr' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gap },
  cardContent: { flex: 1 },
  cardBody: { flexGrow: 1, paddingTop: theme.spacing.edge, paddingBottom: theme.spacing.edge, direction: 'ltr' },
  cardContentSections: { gap: theme.spacing.gapWide, paddingBottom: theme.spacing.gapWide, direction: 'ltr' },
  returnSection: { gap: theme.spacing.gap, direction: 'ltr' },
  dumpText: { writingDirection: 'auto' },
  looseEndSeparator: { height: theme.spacing.gap },
  cardUndo: { gap: theme.spacing.gapWide },
  originalNote: { gap: theme.spacing.gapWide, paddingTop: theme.spacing.gapWide, direction: 'ltr' },
  originalToggle: { paddingVertical: theme.spacing.gap, alignSelf: 'flex-start' },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.gap },
  undo: { gap: theme.spacing.gap },
  dumpState: { gap: theme.spacing.gapWide },
}));
