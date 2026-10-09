---
name: react-native
description: React Native UI patterns for this repo. Use for any UI work in apps/*, packages/ui, or packages/screens - screens, components, hooks, lists, images, styles, accessibility, re-renders. Covers only what the Expo plugin skills do not.
---

# React Native patterns

Rules for UI code in `apps/*`, `packages/ui`, and `packages/screens`, as bad/good pairs.
Tokens, components, and the color rule are in `packages/ui/DESIGN.md`. Read it first.
Text: add keys to the package's `src/text/en.ts` and `tr.ts` (typed `Translation<typeof en>`),
then `const t = useText(text)` from `@factory/app`. Values: `'Hi {name}'`; plurals:
`{ one: '{count} day', other: '{count} days' }` with `t(key, { count })`. A new language adds
`packages/app/src/languages/<code>.ts` (direction and plural rule) and a text file in every package.
The Expo plugin skills cover lists vs. `ScrollView`, theme token structure,
Expo Router and typed routes, safe areas, platform files, keyboard, animation,
React Compiler and memoization, and labels for icon-only controls. Use them for
those topics. This file does not repeat them.

The React Compiler is on (`experiments.reactCompiler` in `app.json`). Use
`useMemo`, `useCallback`, or `React.memo` only for a measured performance problem.

## 1. Derived state: compute during render
Bad:
```tsx
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(`${first} ${last}`), [first, last]);
```
Good:
```tsx
const fullName = `${first} ${last}`;
```
Why: copied state renders twice and can go stale.

## 2. Reset state with a key, not an effect
Bad:
```tsx
const [draft, setDraft] = useState('');
useEffect(() => setDraft(''), [itemId]);
```
Good:
```tsx
<Editor key={itemId} itemId={itemId} />
```
Why: a new `key` mounts a fresh component with fresh state, no extra render.

## 3. User actions go in handlers, not effects
Bad:
```tsx
useEffect(() => { if (saved) router.push('/done'); }, [saved]);
```
Good:
```tsx
async function onSave() {
  await save();
  router.push('/done');
}
```
Why: effects are for syncing with systems outside React, not for reacting to clicks.

## 4. Lists: choose by size, recycle safely

Use `FlatList` for small, bounded lists and short horizontal pagers such as
onboarding. Use FlashList v2 for long or growing lists, especially mixed or
image-heavy feeds and on older Android devices. If a list is large enough that
mounting and filling rows causes visible blank areas or jank, prefer FlashList.
Measure in a release build on a low-end device; development mode distorts list
performance. FlashList v2 is JavaScript-only, requires the New Architecture
(always enabled in Expo SDK 55+), and does not need `estimatedItemSize`.

Both lists need a row component, stable item IDs, and static row styles. FlashList
recycles row views, so reset item-specific state when the item changes, remove
explicit keys inside the recycled row, and pass `getItemType` for mixed rows.
For images in recycled rows, also follow the `recyclingKey` rule below.
This overrides the Expo plugin's inline-style default for list items only.

Bad:
```tsx
<FlatList
  data={items}
  keyExtractor={(_, index) => String(index)}
  renderItem={({ item }) => <View style={{ flexDirection: 'row' }}>…</View>}
/>
```
Good for a small list or pager:
```tsx
<FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <Row item={item} />} />

function Row({ item }: RowProps) {
  return <View style={styles.row}>…</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
```

Good for a long or growing feed:
```tsx
<FlashList
  data={items}
  keyExtractor={(item) => item.id}
  getItemType={(item) => item.kind}
  renderItem={({ item }) => <Row item={item} />}
/>
```
Why: stable IDs preserve row identity across inserts, recycling reduces repeated
mounting, and static row styles avoid rebuilding objects while scrolling.

## 5. Images: expo-image with a size
Bad:
```tsx
<Image source={{ uri }} />
```
Good:
```tsx
<Image source={{ uri }} style={styles.cover} contentFit="cover" placeholder={{ blurhash }} transition={200} />
const styles = StyleSheet.create({ cover: { width: '100%', aspectRatio: 16 / 9 } });
```
Why: remote images have no intrinsic size; without one they render at 0×0 or shift the layout when they load.

## 6. Images in recycling lists: recyclingKey
Bad:
```tsx
<Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
```
Good:
```tsx
<Image source={{ uri: item.avatarUrl }} recyclingKey={item.id} style={styles.avatar} />
```
Why: FlashList reuses row views; without the key the previous row's image shows until the new one loads.

## 7. Accessibility: meaningful images, headers, grouped rows
Bad:
```tsx
<Image source={{ uri: user.photoUrl }} style={styles.avatar} />
<Text style={styles.title}>{title}</Text>
<View style={styles.row}><Text>{name}</Text><Text>{price}</Text></View>
```
Good:
```tsx
<Image source={{ uri: user.photoUrl }} style={styles.avatar} accessible accessibilityLabel={user.name} />
<Text style={styles.title} accessibilityRole="header">{title}</Text>
<View style={styles.row} accessible accessibilityLabel={`${name}, ${price}`}><Text>{name}</Text><Text>{price}</Text></View>
```
Why: `expo-image` is hidden from screen readers by default; headers let users jump between sections; a grouped row is read once.

## 8. No pass-through wrapper components
Bad:
```tsx
const BodyText = (props: TextProps) => <Text {...props} />;
```
Good:
```tsx
<Text style={styles.body}>{body}</Text>
```
Why: a wrapper that adds no behavior or style is one more name to learn and one more file to change.
