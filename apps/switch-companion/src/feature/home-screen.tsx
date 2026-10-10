import { useText } from '@factory/app';
import { useAudioRecorder, AudioModule, RecordingPresets, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { useNetworkState } from 'expo-network';
import { useAi } from '@factory/ai';
import { Button, createStyles, Mark, Screen, Text, useTheme } from '@factory/ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type FlatList as FlatListType, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { text } from '@/text';
import { closeThenProcessDump } from './dump-workflow.ts';
import { createTaskStore, type Dump, type Task } from './task-store.ts';

const tasks = createTaskStore();

export function HomeScreen() {
  const t = useText(text);
  const ai = useAi();
  const network = useNetworkState();
  const styles = useStyles();
  const state = useSyncExternalStore(tasks.subscribe, tasks.getSnapshot, tasks.getSnapshot);
  const [adding, setAdding] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
                  currentId={state.currentTaskId}
                  width={width}
                  onSelect={(id) => act(() => tasks.selectTask(id))}
                  onRetryDump={retryDump}
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

function TaskPager({ items, dumps, currentId, width, onSelect, onRetryDump }: {
  items: Task[]; dumps: Dump[]; currentId: string | null; width: number;
  onSelect: (id: string) => void; onRetryDump: (id: string) => void;
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
              return (
                <TaskCard
                  task={item}
                  width={width}
                  height={height}
                  selected={item.id === currentId}
                  pendingDump={taskDumps.filter((dump) => dump.aiStatus === 'pending').at(-1)}
                  failedDump={taskDumps.filter((dump) => dump.aiStatus === 'failed' && (dump.rawText.length > 0 || dump.audioUri !== undefined)).at(-1)}
                  onRetryDump={onRetryDump}
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

function TaskCard({ task, width, height, selected, pendingDump, failedDump, onRetryDump }: {
  task: Task; width: number; height: number; selected: boolean;
  pendingDump?: Dump; failedDump?: Dump; onRetryDump: (id: string) => void;
}) {
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
        {pendingDump && <Text testID="task-dump-pending" variant="caption">{t('leave.sorting')}</Text>}
        {failedDump && (
          <View style={styles.dumpState}>
            <Text testID="task-dump-not-sorted" variant="caption">{t('leave.notSorted')}</Text>
            <Text>{t('leave.sortFailed')}</Text>
            <Text testID="task-dump-raw-text">{failedDump.rawText || t('leave.failedAudio')}</Text>
            <Button testID="task-dump-retry" variant="secondary" title={t('leave.retry')} onPress={() => onRetryDump(failedDump.id)} />
          </View>
        )}
      </ScrollView>
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
  card: { padding: theme.spacing.edge, borderWidth: 1, borderColor: theme.colors.ink, borderRadius: theme.radius.corner },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.gap },
  cardBody: { paddingTop: theme.spacing.edge },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.gap },
  undo: { gap: theme.spacing.gap },
  dumpState: { gap: theme.spacing.gapWide },
}));
