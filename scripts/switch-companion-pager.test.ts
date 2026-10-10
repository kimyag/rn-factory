import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Execute the production pager with native views and hooks supplied by a headless host.
// This checks its layout boundary and event ordering; it does not simulate native touch.
const appRequire = createRequire(new URL('../apps/switch-companion/package.json', import.meta.url));
const ts = appRequire('typescript') as typeof import('../apps/switch-companion/node_modules/typescript/lib/typescript.js');
const source = ts.transpileModule(readFileSync(new URL('../apps/switch-companion/src/feature/home-screen.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText + '\nexports.TaskPager = TaskPager; exports.TaskCard = TaskCard;';

type Node = { type: unknown; props: Record<string, unknown> };
type Dump = { id: string; taskId: string; createdAt: number; rawText: string; source: 'text' | 'voice'; aiStatus: 'pending' | 'done' | 'failed'; audioUri?: string; whereIWas?: string; nextStep?: string };
type LooseEnd = { id: string; taskId: string; dumpId: string; text: string; status: 'open' | 'done' | 'later'; updatedAt: number };
type Props = { items: { id: string; title: string; createdAt: number }[]; dumps: Dump[]; looseEnds: LooseEnd[]; currentId: string; width: number; onSelect: (id: string) => void; onRetryDump: (id: string) => void };
type CardProps = { task: Props['items'][number]; width: number; height: number; selected: boolean; pendingDump?: Dump; failedDump?: Dump; sortedDump?: Dump; sortedLooseEnds: LooseEnd[]; onRetryDump: (id: string) => void };
const items = [{ id: 'a', title: 'First', createdAt: 1 }, { id: 'b', title: 'Second', createdAt: 2 }];
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function event(index: number) {
  return { nativeEvent: { contentOffset: { x: index * 320 }, velocity: { x: 0 } } };
}
function host(reducedMotion = false) {
  const slots: unknown[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const exports: { TaskPager?: (props: Props) => Node; TaskCard?: (props: CardProps) => Node } = {};
  runInNewContext(source, {
    exports,
    require(name: string) {
      switch (name) {
        case 'react/jsx-runtime': return { jsx, jsxs: jsx };
        case 'react': return {
          forwardRef: (component: unknown) => component,
          useRef(value: unknown) {
            const index = cursor++;
            return slots[index] ??= { current: value };
          },
          useState(value: unknown) {
            const index = cursor++;
            slots[index] ??= value;
            return [slots[index], (next: unknown) => { slots[index] = next; }];
          },
          useEffect(effect: () => void, deps?: unknown[]) {
            const index = cursor++;
            const previous = slots[index] as unknown[] | undefined;
            if (!deps || !previous || deps.some((value, i) => !Object.is(value, previous[i]))) effects.push(effect);
            slots[index] = deps;
          },
        };
        case '@factory/app': return { useText: () => (key: string) => key };
        case '@factory/ui': return { Button: 'Button', Mark: 'Mark', Text: 'Text', Screen: 'Screen', createStyles: () => () => ({}) };
        case 'react-native': return { View: 'View', Pressable: 'Pressable', FlatList: 'FlatList', Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } };
        case 'expo-audio': return { useAudioRecorder: () => ({}), AudioModule: {}, RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorderState: () => ({}) };
        case 'expo-file-system': return { File: class {} };
        case 'expo-network': return { useNetworkState: () => ({}) };
        case '@factory/ai': return { useAi: () => ({}) };
        case 'react-native-reanimated': return { useReducedMotion: () => reducedMotion };
        case 'react-native-gesture-handler': return { Gesture: { Native: () => ({}) }, GestureDetector: 'GestureDetector' };
        case './task-store.ts': return { createTaskStore: () => ({}) };
        case './dump-workflow.ts': return { closeThenProcessDump: () => Promise.resolve() };
        case '@/text': return {};
        default: throw new Error(`Unexpected import ${name}`);
      }
    },
  });
  return {
    render(props: Props) {
      cursor = 0;
      effects = [];
      const tree = exports.TaskPager!(props);
      return { tree, commit: () => effects.forEach((effect) => effect()) };
    },
    renderCard(props: CardProps) {
      cursor = 0;
      return exports.TaskCard!(props);
    },
  };
}

test('horizontal recycler waits for an independent measured viewport and bounds every card', () => {
  const renderer = host();
  const props = { items, dumps: [], looseEnds: [], currentId: 'a', width: 320, onSelect() {}, onRetryDump() {} };
  const first = renderer.render(props);
  assert.equal(nodes(first.tree).some((node) => node.type === 'FlatList'), false, 'Wait until the viewport has an independent measured height');
  const viewport = nodes(first.tree).find((node) => typeof node.props.onLayout === 'function');
  assert.ok(viewport, 'Measure the viewport independently of recycled content');
  (viewport.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { height: 480 } } });
  const list = nodes(renderer.render(props).tree).find((node) => node.type === 'FlatList')!;
  assert.equal((list.props.style as { height: number }).height, 480);
  const card = (list.props.renderItem as (props: unknown) => Node)({ item: items[0] });
  assert.equal(card.props.height, 480);
});

test('opens at a saved non-first task with deterministic fixed-width page layout', () => {
  const renderer = host();
  const props = { items, dumps: [], looseEnds: [], currentId: 'b', width: 320, onSelect() {}, onRetryDump() {} };
  const first = renderer.render(props);
  const viewport = nodes(first.tree).find((node) => typeof node.props.onLayout === 'function')!;
  (viewport.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { height: 480 } } });
  const list = nodes(renderer.render(props).tree).find((node) => node.type === 'FlatList')!;
  assert.equal(list.props.initialScrollIndex, 1);
  const getItemLayout = list.props.getItemLayout as (_data: unknown, index: number) => { length: number; offset: number; index: number };
  const layout = getItemLayout(items, 1);
  assert.equal(layout.length, 320);
  assert.equal(layout.offset, 320);
  assert.equal(layout.index, 1);
});

test('finished swipes choose once; stored selection scrolls only when the visible card differs', () => {
  const renderer = host();
  const choices: string[] = [];
  let currentId = 'a';
  const props = () => ({ items, dumps: [], looseEnds: [], currentId, width: 320, onSelect(id: string) { choices.push(id); currentId = id; }, onRetryDump() {} });
  const first = renderer.render(props());
  const viewport = nodes(first.tree).find((node) => typeof node.props.onLayout === 'function')!;
  (viewport.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { height: 480 } } });
  const scrolls: number[] = [];
  function render() {
    const frame = renderer.render(props());
    const list = nodes(frame.tree).find((node) => node.type === 'FlatList')!;
    (list.props.ref as { current: unknown }).current = { scrollToIndex: ({ index }: { index: number }) => { scrolls.push(index); } };
    frame.commit();
    return list.props as {
      onScrollBeginDrag: () => void;
      onMomentumScrollEnd: (event: unknown) => void;
      onScrollEndDrag: (event: unknown) => void;
    };
  }
  let list = render();
  assert.deepEqual(scrolls, []);
  list.onScrollBeginDrag();
  assert.deepEqual(choices, []);
  list.onMomentumScrollEnd(event(1));
  list = render();
  list.onMomentumScrollEnd(event(1));
  assert.deepEqual(choices, ['b']);
  assert.deepEqual(scrolls, []);
  currentId = 'a';
  list = render();
  render();
  assert.deepEqual(scrolls, [0]);
  list.onMomentumScrollEnd(event(0));
  render();
  assert.deepEqual(choices, ['b']);
  assert.deepEqual(scrolls, [0]);
  list.onScrollBeginDrag();
  list.onScrollEndDrag(event(1));
  render();
  assert.deepEqual(choices, ['b', 'b']);
});


test('accessible navigation saves intent before scrolling and reduced-motion navigation settles without momentum', () => {
  const renderer = host(true);
  let currentId = 'a';
  const order: string[] = [];
  const props = () => ({ items, dumps: [], looseEnds: [], currentId, width: 320, onSelect(id: string) { currentId = id; order.push(`save:${id}`); }, onRetryDump() {} });
  const first = renderer.render(props());
  const viewport = nodes(first.tree).find((node) => typeof node.props.onLayout === 'function')!;
  (viewport.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { height: 480 } } });
  function render() {
    const frame = renderer.render(props());
    const list = nodes(frame.tree).find((node) => node.type === 'FlatList')!;
    (list.props.ref as { current: unknown }).current = {
      scrollToIndex: ({ index, animated }: { index: number; animated: boolean }) => {
        assert.equal(currentId, items[index].id);
        assert.equal(animated, false);
        order.push(`scroll:${index}`);
      },
    };
    frame.commit();
    return frame.tree;
  }
  const tree = render();
  (nodes(tree).find((node) => node.props.testID === 'task-next')!.props.onPress as () => void)();
  assert.deepEqual(order, ['save:b']);
  const next = render();
  (nodes(next).find((node) => node.props.testID === 'task-previous')!.props.onPress as () => void)();
  render();
  assert.deepEqual(order, ['save:b', 'scroll:1', 'save:a', 'scroll:0']);
});

test('sorted return view renders next step, where I was, and loose ends in order', () => {
  const renderer = host();
  const sortedDump: Dump = {
    id: 'd1', taskId: 'a', createdAt: 2, rawText: 'یادداشت اصلی', source: 'voice', aiStatus: 'done',
    whereIWas: 'داشتم طرح را می‌نوشتم', nextStep: 'فردا طرح را مرور کن',
  };
  const looseEnd: LooseEnd = { id: 'e1', taskId: 'a', dumpId: 'd1', text: 'منابع را بررسی کن', status: 'open', updatedAt: 3 };
  const card = renderer.renderCard({
    task: items[0]!, width: 320, height: 480, selected: true,
    sortedDump, sortedLooseEnds: [looseEnd], onRetryDump() {},
  });
  const list = nodes(card).find((node) => node.type === 'FlatList');
  assert.ok(list);
  const header = nodes(list.props.ListHeaderComponent);
  const headerOrder = header
    .map((node) => node.props.testID)
    .filter((id) => id === 'task-dump-next-step' || id === 'task-dump-where-i-was' || id === 'task-dump-section-loose-ends');
  const renderedEnds = (list.props.data as LooseEnd[]).map((item, index) => {
    const rendered = (list.props.renderItem as (input: { item: LooseEnd; index: number }) => Node)({ item, index });
    return nodes(rendered).find((node) => node.props.testID === `task-dump-loose-end-${index}`)?.props.testID;
  });
  assert.deepEqual([...headerOrder, ...renderedEnds], [
    'task-dump-next-step', 'task-dump-where-i-was', 'task-dump-section-loose-ends', 'task-dump-loose-end-0',
  ]);
  assert.equal((list.props.data as LooseEnd[])[0]?.text, 'منابع را بررسی کن');
  const footer = nodes(list.props.ListFooterComponent);
  assert.ok(footer.some((node) => node.props.testID === 'task-dump-original-toggle'));
  assert.equal(footer.some((node) => node.props.testID === 'task-dump-original-text'), false, 'the original note starts collapsed');
  (footer.find((node) => node.props.testID === 'task-dump-original-toggle')!.props.onPress as () => void)();
  const expanded = renderer.renderCard({
    task: items[0]!, width: 320, height: 480, selected: true,
    sortedDump, sortedLooseEnds: [looseEnd], onRetryDump() {},
  });
  const expandedList = nodes(expanded).find((node) => node.type === 'FlatList')!;
  assert.ok(nodes(expandedList.props.ListFooterComponent).some((node) => node.props.testID === 'task-dump-original-text'));
});

test('task card keeps the latest sorted dump under newer pending and failed states', () => {
  const renderer = host();
  const dumps: Dump[] = [
    { id: 'old', taskId: 'a', createdAt: 1, rawText: 'Old return note', source: 'text', aiStatus: 'done', whereIWas: 'Old', nextStep: 'Old next' },
    { id: 'old-failed', taskId: 'a', createdAt: 2, rawText: 'Already replaced', source: 'text', aiStatus: 'failed' },
    { id: 'latest', taskId: 'a', createdAt: 3, rawText: 'Current return note', source: 'voice', aiStatus: 'done', whereIWas: 'Current', nextStep: 'Continue' },
    { id: 'pending', taskId: 'a', createdAt: 4, rawText: '', source: 'voice', aiStatus: 'pending' },
    { id: 'failed', taskId: 'a', createdAt: 5, rawText: 'New failed note', source: 'text', aiStatus: 'failed' },
  ];
  const props: Props = { items: [items[0]!], dumps, looseEnds: [], currentId: 'a', width: 320, onSelect() {}, onRetryDump() {} };
  const first = renderer.render(props);
  const viewport = nodes(first.tree).find((node) => typeof node.props.onLayout === 'function')!;
  (viewport.props.onLayout as (event: unknown) => void)({ nativeEvent: { layout: { height: 480 } } });
  const list = nodes(renderer.render(props).tree).find((node) => node.type === 'FlatList')!;
  const card = (list.props.renderItem as (input: { item: Props['items'][number] }) => Node)({ item: items[0]! });
  assert.equal((card.props.sortedDump as Dump).id, 'latest');
  assert.equal((card.props.pendingDump as Dump).id, 'pending');
  assert.equal((card.props.failedDump as Dump).id, 'failed');
});
