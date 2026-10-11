import type { LooseEnd, Task, TaskState } from './task-store.ts';

export type LooseEndListItem =
  | { kind: 'task'; id: string; title: string }
  | { kind: 'later'; id: string; title: string }
  | { kind: 'item'; end: LooseEnd; taskTitle: string; complete: boolean };

export function looseEndListItems(tasks: Task[], looseEnds: LooseEnd[], completingIds: string[] = []): LooseEndListItem[] {
  const openTasks = tasks.filter((task) => task.archivedAt === undefined);
  const openIds = new Set(openTasks.map((task) => task.id));
  const taskById = new Map(openTasks.map((task) => [task.id, task]));
  const completing = new Set(completingIds);
  const active = looseEnds.filter((end) => (end.status === 'open' || completing.has(end.id)) && openIds.has(end.taskId));
  const later = looseEnds.filter((end) => end.status === 'later' && openIds.has(end.taskId));
  const rows: LooseEndListItem[] = [];

  for (const task of openTasks) {
    const ends = active.filter((end) => end.taskId === task.id);
    if (!ends.length) continue;
    rows.push({ kind: 'task', id: `task:${task.id}`, title: task.title });
    rows.push(...ends.map((end) => ({ kind: 'item' as const, end, taskTitle: task.title, complete: completing.has(end.id) })));
  }

  if (later.length) {
    rows.push({ kind: 'later', id: 'later', title: '' });
    const laterByTask = new Map<string, LooseEnd[]>();
    for (const end of later) laterByTask.set(end.taskId, [...(laterByTask.get(end.taskId) ?? []), end]);
    for (const task of openTasks) {
      const ends = laterByTask.get(task.id);
      if (!ends?.length) continue;
      rows.push({ kind: 'task', id: `later-task:${task.id}`, title: task.title });
      rows.push(...ends.map((end) => ({ kind: 'item' as const, end, taskTitle: taskById.get(end.taskId)!.title, complete: false })));
    }
  }
  return rows;
}

export function createDevelopmentSeed(now: number): TaskState {
  const tasks = Array.from({ length: 10 }, (_, index) => ({
    id: `perf-task-${index + 1}`,
    title: `Performance task ${index + 1}`,
    createdAt: now + index,
  }));
  const dumps = tasks.map((task, index) => ({
    id: `perf-dump-${index + 1}`,
    taskId: task.id,
    createdAt: now + index,
    rawText: 'Performance seed note',
    whereIWas: 'Reviewing the task list.',
    nextStep: 'Continue the performance check.',
    source: 'text' as const,
    aiStatus: 'done' as const,
  }));
  const looseEnds = Array.from({ length: 500 }, (_, index) => {
    const taskIndex = index % tasks.length;
    const task = tasks[taskIndex]!;
    return {
      id: `perf-loose-end-${index + 1}`,
      taskId: task.id,
      dumpId: dumps[taskIndex]!.id,
      text: `Performance loose end ${index + 1}`,
      status: 'open' as const,
      updatedAt: now + index,
    };
  });
  return { tasks, dumps, looseEnds, currentTaskId: tasks[0]!.id };
}
