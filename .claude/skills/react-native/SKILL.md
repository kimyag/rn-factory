---
name: react-native
description: React Native UI patterns for this repo. Use for any UI work in apps/* or packages/ui - screens, components, hooks, lists, images, styles, accessibility, re-renders. Covers only what the Expo plugin skills do not.
---

# React Native patterns

Rules for UI code in `apps/*` and `packages/ui`, as bad/good pairs.
The Expo plugin skills cover lists vs. `ScrollView`, theme token structure,
Expo Router and typed routes, safe areas, platform files, keyboard, and
animation. Use them for those topics. This file does not repeat them.

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

## 4. Re-renders: no manual memo
Bad:
```tsx
const onPress = useCallback(() => open(id), [id]);
const total = useMemo(() => sum(items), [items]);
export default memo(Row);
```
Good:
```tsx
const onPress = () => open(id);
const total = sum(items);
export default Row;
```
Why: the React Compiler is on (`experiments.reactCompiler` in `app.json`) and memoizes for us; add memo only for a measured problem or where an Expo plugin skill requires it (gestures).

## 5. List rows: a row component, stable keys, static styles
This overrides the Expo plugin's inline-style default, for list items only.

Bad:
```tsx
<FlatList
  data={items}
  keyExtractor={(_, index) => String(index)}
  renderItem={({ item }) => <View style={{ flexDirection: 'row' }}>…</View>}
/>
```
Good:
```tsx
<FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <Row item={item} />} />

function Row({ item }: RowProps) {
  return <View style={styles.row}>…</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
```
Why: index keys break row state on insert and delete; inline objects are rebuilt for every row on every render.

## 6. Images: expo-image with a size
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

## 7. Images in recycling lists: recyclingKey
Bad:
```tsx
<Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
```
Good:
```tsx
<Image source={{ uri: item.avatarUrl }} recyclingKey={item.id} style={styles.avatar} />
```
Why: FlashList reuses row views; without the key the previous row's image shows until the new one loads.

## 8. Accessibility: label icon-only controls
Bad:
```tsx
<Pressable onPress={onClose}><CloseIcon /></Pressable>
```
Good:
```tsx
<Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel}><CloseIcon /></Pressable>
```
Why: with no text inside, the screen reader announces only "button". The label comes from a translation key.

## 9. Accessibility: meaningful images, headers, grouped rows
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

## 10. No pass-through wrapper components
Bad:
```tsx
const BodyText = (props: TextProps) => <Text {...props} />;
```
Good:
```tsx
<Text style={styles.body}>{body}</Text>
```
Why: a wrapper that adds no behavior or style is one more name to learn and one more file to change.
