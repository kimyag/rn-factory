import { storedValue, z, type StoredValue } from '@factory/core/storage';

const id = z.string().min(1);
const timestamp = z.number().int().nonnegative();
export const taskSchema = z.object({
  id,
  title: z.string().trim().min(1),
  createdAt: timestamp,
  archivedAt: timestamp.optional(),
});
export const dumpSchema = z.object({
  id, taskId: id, createdAt: timestamp, rawText: z.string(),
  whereIWas: z.string().optional(), nextStep: z.string().optional(),
  detectedLanguage: z.string().optional(), audioUri: z.string().optional(),
  source: z.enum(['voice', 'text']),
  aiStatus: z.enum(['pending', 'done', 'failed']),
});
export const looseEndSchema = z.object({
  id, taskId: id, dumpId: id, text: z.string(),
  status: z.enum(['open', 'done', 'later']), updatedAt: timestamp,
});
const recordsSchema = z.object({
  tasks: z.array(taskSchema), dumps: z.array(dumpSchema), looseEnds: z.array(looseEndSchema),
});
export const taskStateSchema = recordsSchema.extend({ currentTaskId: id.nullable() }).superRefine((state, context) => {
  for (const records of [state.tasks, state.dumps, state.looseEnds]) {
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate IDs' });
    }
  }
  const tasks = new Set(state.tasks.map((task) => task.id));
  const dumps = new Map(state.dumps.map((dump) => [dump.id, dump.taskId]));
  if (state.dumps.some((dump) => !tasks.has(dump.taskId)) ||
      state.looseEnds.some((end) => !tasks.has(end.taskId) || dumps.get(end.dumpId) !== end.taskId)) {
    context.addIssue({ code: 'custom', message: 'Invalid record relationship' });
  }
  const open = state.tasks.filter((task) => task.archivedAt === undefined);
  if (open.length ? !open.some((task) => task.id === state.currentTaskId) : state.currentTaskId !== null) {
    context.addIssue({ code: 'custom', message: 'Current task must be open' });
  }
});
export type Task = z.infer<typeof taskSchema>;
export type Dump = z.infer<typeof dumpSchema>;
export type LooseEnd = z.infer<typeof looseEndSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export const emptyTaskState: TaskState = { tasks: [], dumps: [], looseEnds: [], currentTaskId: null };

// Version 1 had the records but no persisted task choice.
export function migrateTaskState(value: unknown, fromVersion: number): unknown {
  if (fromVersion !== 1 && fromVersion !== 2) return value;
  const old = recordsSchema.extend({ currentTaskId: id.nullable().optional() }).parse(value);
  const open = old.tasks.filter((task) => task.archivedAt === undefined);
  return { ...old, currentTaskId: open.find((task) => task.id === old.currentTaskId)?.id ?? open[0]?.id ?? null };
}

export function taskStorage() {
  return storedValue({
    key: 'switchCompanion.tasks', schema: taskStateSchema, fallback: emptyTaskState,
    version: 3, migrate: migrateTaskState,
  });
}

export function createTaskStore(storage: StoredValue<TaskState> = taskStorage()) {
  let snapshot = storage.get();
  const listeners = new Set<() => void>();
  function save(next: TaskState) {
    const checked = taskStateSchema.parse(next);
    storage.set(checked);
    snapshot = checked;
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    addTask(title: string, taskId: string, now: number) {
      const task = taskSchema.parse({ id: taskId, title, createdAt: now });
      save({ ...snapshot, tasks: [...snapshot.tasks, task], currentTaskId: task.id });
    },
    selectTask(taskId: string) {
      if (snapshot.currentTaskId === taskId) return;
      save({ ...snapshot, currentTaskId: taskId });
    },
    archiveTask(taskId: string, now: number) {
      const open = snapshot.tasks.filter((task) => task.archivedAt === undefined);
      const index = open.findIndex((task) => task.id === taskId);
      if (index < 0) return;
      const remaining = open.filter((task) => task.id !== taskId);
      save({
        ...snapshot,
        tasks: snapshot.tasks.map((task) => task.id === taskId ? { ...task, archivedAt: now } : task),
        currentTaskId: snapshot.currentTaskId === taskId
          ? remaining[Math.min(index, remaining.length - 1)]?.id ?? null : snapshot.currentTaskId,
      });
    },
    undoArchive(taskId: string) {
      if (!snapshot.tasks.some((task) => task.id === taskId && task.archivedAt !== undefined)) return;
      save({
        ...snapshot,
        tasks: snapshot.tasks.map((task) => {
          if (task.id !== taskId) return task;
          const { archivedAt: _archivedAt, ...open } = task;
          return open;
        }),
        currentTaskId: taskId,
      });
    },
    createPendingDump(dump: Dump) {
      const checked = dumpSchema.parse(dump);
      save({ ...snapshot, dumps: [...snapshot.dumps, checked] });
    },
    replacePendingAudio(dumpId: string, audioUri: string | undefined) {
      const current = snapshot.dumps.find((dump) => dump.id === dumpId);
      if (!current || current.aiStatus !== 'pending') return;
      save({ ...snapshot, dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, audioUri } : dump) });
    },
    setDumpTranscript(dumpId: string, rawText: string, detectedLanguage: string) {
      const current = snapshot.dumps.find((dump) => dump.id === dumpId);
      if (!current || current.aiStatus !== 'pending') return;
      save({ ...snapshot, dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, rawText, detectedLanguage } : dump) });
    },
    setDumpRawText(dumpId: string, rawText: string) {
      const current = snapshot.dumps.find((dump) => dump.id === dumpId);
      if (!current || current.aiStatus !== 'pending') return;
      save({ ...snapshot, dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, rawText } : dump) });
    },
    finishDump(dumpId: string, update: { rawText: string; detectedLanguage?: string; whereIWas: string; nextStep: string; looseEnds: LooseEnd[] }) {
      const current = snapshot.dumps.find((dump) => dump.id === dumpId);
      if (!current || current.aiStatus !== 'pending') return;
      save({
        ...snapshot,
        dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, ...update, audioUri: undefined, aiStatus: 'done' } : dump),
        looseEnds: [...snapshot.looseEnds, ...update.looseEnds.map((end) => looseEndSchema.parse(end))],
      });
    },
    failDump(dumpId: string, rawText: string) {
      if (!snapshot.dumps.some((dump) => dump.id === dumpId)) return;
      save({ ...snapshot, dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, rawText, aiStatus: 'failed' } : dump) });
    },
    retryDump(dumpId: string) {
      const current = snapshot.dumps.find((dump) => dump.id === dumpId);
      if (!current || current.aiStatus !== 'failed') return;
      save({ ...snapshot, dumps: snapshot.dumps.map((dump) => dump.id === dumpId ? { ...dump, aiStatus: 'pending' } : dump) });
    },
  };
}
