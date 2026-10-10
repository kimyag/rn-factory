import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { createTaskStore, dumpSchema, emptyTaskState, looseEndSchema, migrateTaskState, taskStateSchema, taskStorage } from '../apps/switch-companion/src/feature/task-store.ts';
import { closeThenProcessDump } from '../apps/switch-companion/src/feature/dump-workflow.ts';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  });
});
afterEach(() => {
  if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

const first = { id: 'a', title: 'First', createdAt: 1 };
const second = { id: 'b', title: 'Second', createdAt: 2 };
const dump = { id: 'dump', taskId: 'a', createdAt: 3, rawText: 'Remember this', source: 'text' as const, aiStatus: 'failed' as const };
const looseEnd = { id: 'end', taskId: 'a', dumpId: 'dump', text: 'Check result', status: 'later' as const, updatedAt: 4 };

function seed(version: number, value: unknown) {
  values.set('switchCompanion.tasks', JSON.stringify({ version, value }));
}

test('stored tasks and the explicit choice survive a new store instance', () => {
  const store = createTaskStore();
  store.addTask(' First ', 'a', 1);
  store.addTask('Second', 'b', 2);
  store.selectTask('a');
  assert.equal(createTaskStore().getSnapshot().currentTaskId, 'a');
  assert.equal(store.getSnapshot().tasks[0].title, 'First');
  assert.equal(JSON.parse(values.get('switchCompanion.tasks')!).version, 3);
});

test('archive selects the nearest remaining card; undo retains all records', () => {
  const original = { tasks: [first, second], dumps: [dump], looseEnds: [looseEnd], currentTaskId: 'a' };
  seed(3, original);
  const store = createTaskStore();
  store.archiveTask('a', 10);
  assert.equal(store.getSnapshot().currentTaskId, 'b');
  assert.equal(store.getSnapshot().tasks[0].archivedAt, 10);
  assert.deepEqual(store.getSnapshot().dumps, [dump]);
  assert.deepEqual(store.getSnapshot().looseEnds, [looseEnd]);
  store.undoArchive('a');
  assert.deepEqual(createTaskStore().getSnapshot(), original);
});

test('archive last task clears current choice, and undo restores it', () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  store.archiveTask('a', 2);
  assert.equal(createTaskStore().getSnapshot().currentTaskId, null);
  store.undoArchive('a');
  assert.equal(createTaskStore().getSnapshot().currentTaskId, 'a');
});

test('archive a non-current task preserves the user choice', () => {
  seed(3, { tasks: [first, second], dumps: [], looseEnds: [], currentTaskId: 'b' });
  const store = createTaskStore();
  store.archiveTask('a', 5);
  assert.equal(store.getSnapshot().currentTaskId, 'b');
});

test('version 1 migration adds a choice, skips archived tasks and keeps relationships', () => {
  const old = { tasks: [{ ...first, archivedAt: 5 }, second], dumps: [dump], looseEnds: [looseEnd] };
  seed(1, old);
  assert.deepEqual(taskStorage().get(), { ...old, currentTaskId: 'b' });
  const store = createTaskStore();
  store.addTask('Third', 'c', 6);
  assert.equal(JSON.parse(values.get('switchCompanion.tasks')!).version, 3);
  assert.equal(createTaskStore().getSnapshot().currentTaskId, 'c');
});

test('migration preserves an explicit valid choice and handles no open tasks', () => {
  assert.equal(taskStateSchema.parse(migrateTaskState({ tasks: [first, second], dumps: [], looseEnds: [], currentTaskId: 'b' }, 1)).currentTaskId, 'b');
  assert.deepEqual(taskStateSchema.parse(migrateTaskState({ tasks: [], dumps: [], looseEnds: [] }, 1)), emptyTaskState);
});

test('version 2 migration adds local audio metadata fields without losing dump or task data', () => {
  const old = { tasks: [first], dumps: [dump], looseEnds: [looseEnd], currentTaskId: 'a' };
  seed(2, old);
  const migrated = taskStorage().get();
  assert.deepEqual(migrated.dumps, [dump]);
  assert.equal(migrated.currentTaskId, 'a');
  createTaskStore().addTask('Second', 'b', 3);
  assert.equal(JSON.parse(values.get('switchCompanion.tasks')!).version, 3);
});

test('pending dump persists before processing; completion saves transcript and loose ends atomically', () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  const pending = { id: 'd2', taskId: 'a', createdAt: 2, rawText: '', source: 'voice' as const, aiStatus: 'pending' as const };
  store.createPendingDump(pending);
  assert.equal(createTaskStore().getSnapshot().dumps[0]?.aiStatus, 'pending');
  store.setDumpTranscript('d2', 'Keep the draft in Turkish.', 'Turkish');
  store.finishDump('d2', {
    rawText: 'Keep the draft in Turkish.', detectedLanguage: 'Turkish', whereIWas: 'Drafting a plan.', nextStep: 'Review the outline.',
    looseEnds: [{ id: 'e2', taskId: 'a', dumpId: 'd2', text: 'Check dates.', status: 'open', updatedAt: 3 }],
  });
  const restored = createTaskStore().getSnapshot();
  assert.equal(restored.dumps[0]?.aiStatus, 'done');
  assert.equal(restored.dumps[0]?.detectedLanguage, 'Turkish');
  assert.deepEqual(restored.looseEnds.map((end) => end.text), ['Check dates.']);
});

test('failed dump retains raw input and local audio for retry, then retry enters pending', () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  store.createPendingDump({ id: 'd3', taskId: 'a', createdAt: 2, rawText: '', source: 'voice', aiStatus: 'pending' });
  store.replacePendingAudio('d3', 'file:///recording.m4a');
  store.failDump('d3', 'Recognized words');
  assert.equal(createTaskStore().getSnapshot().dumps[0]?.rawText, 'Recognized words');
  assert.equal(createTaskStore().getSnapshot().dumps[0]?.audioUri, 'file:///recording.m4a');
  store.retryDump('d3');
  assert.equal(createTaskStore().getSnapshot().dumps[0]?.aiStatus, 'pending');
});

test('corrupt, future and invalid legacy storage fall back safely', () => {
  values.set('switchCompanion.tasks', '{broken');
  assert.deepEqual(taskStorage().get(), emptyTaskState);
  seed(4, { tasks: [first], dumps: [], looseEnds: [], currentTaskId: 'a' });
  assert.deepEqual(taskStorage().get(), emptyTaskState);
  seed(1, { tasks: [{ ...first, title: '' }], dumps: [], looseEnds: [] });
  assert.deepEqual(taskStorage().get(), emptyTaskState);
});

test('schema rejects duplicates, dangling references and archived selections', () => {
  const valid = { tasks: [first], dumps: [dump], looseEnds: [looseEnd], currentTaskId: 'a' };
  assert.ok(taskStateSchema.safeParse(valid).success);
  assert.equal(taskStateSchema.safeParse({ ...valid, tasks: [first, first] }).success, false);
  assert.equal(taskStateSchema.safeParse({ ...valid, dumps: [{ ...dump, taskId: 'missing' }] }).success, false);
  assert.equal(taskStateSchema.safeParse({ ...valid, looseEnds: [{ ...looseEnd, dumpId: 'missing' }] }).success, false);
  assert.equal(taskStateSchema.safeParse({ ...valid, tasks: [{ ...first, archivedAt: 5 }] }).success, false);
  assert.equal(dumpSchema.safeParse({ ...dump, source: 'unknown' }).success, false);
  assert.equal(looseEndSchema.safeParse({ ...looseEnd, status: 'unknown' }).success, false);
});

test('failed persistence does not publish an unsaved snapshot', () => {
  const store = createTaskStore({ get: () => emptyTaskState, set: () => { throw new Error('Disk full'); } });
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  assert.throws(() => store.addTask('First', 'a', 1), /Disk full/);
  assert.deepEqual(store.getSnapshot(), emptyTaskState);
  assert.equal(notifications, 0);
  unsubscribe();
});

test('AI failure happens after the saved dump closes the sheet and preserves the raw note', async () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  store.createPendingDump({ id: 'd4', taskId: 'a', createdAt: 2, rawText: 'Review the prototype', source: 'text', aiStatus: 'pending' });
  let sheetClosed = false;
  let aiStarted = false;
  const processing = closeThenProcessDump(store, 'd4', () => {
    assert.equal(store.getSnapshot().dumps[0]?.aiStatus, 'pending');
    sheetClosed = true;
  }, async () => {
    assert.equal(sheetClosed, true, 'the sheet must close before AI starts');
    aiStarted = true;
    throw new Error('AI unavailable');
  });

  assert.equal(sheetClosed, true, 'saving closes the sheet synchronously');
  await processing;
  assert.equal(aiStarted, true);
  assert.equal(store.getSnapshot().dumps[0]?.aiStatus, 'failed');
  assert.equal(store.getSnapshot().dumps[0]?.rawText, 'Review the prototype');
});

test('blank titles and invalid selections do not overwrite stored state', () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  const before = values.get('switchCompanion.tasks');
  assert.throws(() => store.addTask('   ', 'b', 2));
  assert.throws(() => store.selectTask('missing'));
  assert.equal(values.get('switchCompanion.tasks'), before);
});


test('external-store feedback selecting the current task settles without another write or notification', () => {
  const store = createTaskStore();
  store.addTask('First', 'a', 1);
  store.addTask('Second', 'b', 2);
  const before = store.getSnapshot();
  let notifications = 0;
  store.subscribe(() => {
    notifications += 1;
    assert.ok(notifications < 50, 'Maximum update depth exceeded: selection notification feeds itself');
    store.selectTask(store.getSnapshot().currentTaskId!);
  });
  store.selectTask('b');
  assert.strictEqual(store.getSnapshot(), before);
  assert.equal(notifications, 0);
  store.selectTask('a');
  assert.equal(notifications, 1);
  const selected = store.getSnapshot();
  store.selectTask('a');
  assert.strictEqual(store.getSnapshot(), selected);
  assert.equal(notifications, 1);
  assert.equal(createTaskStore().getSnapshot().currentTaskId, 'a');
});
