import type { createTaskStore } from './task-store.ts';

type TaskStore = ReturnType<typeof createTaskStore>;

export async function closeThenProcessDump(
  store: TaskStore,
  dumpId: string,
  closeSheet: () => void,
  process: () => Promise<void>,
): Promise<void> {
  closeSheet();
  try {
    await process();
  } catch {
    const dump = store.getSnapshot().dumps.find((item) => item.id === dumpId);
    if (dump) store.failDump(dumpId, dump.rawText);
  }
}
