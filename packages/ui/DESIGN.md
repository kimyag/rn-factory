# Design system

The house style for every app. Tokens live in `src/tokens.ts`; neutrals and
the contrast check live in `@factory/core`. Get tokens with `useTheme()` or
`createStyles((theme) => …)`. Never hardcode a color, size, or font.

## Color
| Token | Use |
|---|---|
| `paper` | Screen background, text on ink, the dot of a complete Mark. |
| `ink` | Text, the primary Button, header buttons, links. |
| `inkMuted` | Captions, secondary text, empty Marks. |
| `line` | Dividers only, never the only edge of a control. |
| `achievement` | The app color: completion, progress, success. Nothing else. |
| `onAchievement` | Anything drawn on `achievement`. |

**Color rule:** the app color appears only for achievement. Buttons, links,
and headers use ink. Settings validation keeps `achievement` at 3:1 on paper
and `onAchievement` at 4.5:1 on `achievement`, in both modes.

## Space, corners, type, motion
- Spacing on a 4 px grid: `edge` 16 (screen edges), `gap` 8, `gapWide` 12.
- Corners are 2 px. Only the primary Button is chamfered (7 px cuts).
- Text: `title` (title font, 28/34), `body` (system sans, 17/24),
  `caption` (system sans, muted, 13/18), `mono` (mono font, 13/18).
  Use `mono` for numbers and short labels only.
- Motion: 150 ms ease-out fades. 400 ms only for the change to the app color.

## Components
- `Screen`: the root of every screen. It does not scroll; add `scroll` for
  long content. Lists put a `FlatList` inside a plain `Screen`.
- `Text`: all text. `variant` picks the role; `title` is read as a header.
- `Button`: `primary` (ink, chamfered) for the one main action on a screen,
  `secondary` (outlined) for the others.
- `Mark`: a ring with a dot. `empty` (muted), `active` (ink; 150 ms fade between
  the two), `complete` (fills with the app color in 400 ms), `loading` (the dot
  circles inside the ring). Use it for onboarding progress, completion in rows,
  selection in choice rows (`active` = selected, never `complete`), and loading.

**Mark rule:** Mark is the only component with its own motion, and the only
place the app color fills a shape.

Add a component only when the same UI appears twice.

## Fonts
Each font role in `app.settings.ts` (`title`, `mono`) is `'system'` or
`{ family, file, weight }`: the font's PostScript name, a `./assets/fonts/`
file in the app folder, and its weight. Body text is always the system sans.
The config embeds the file; the app's `_layout.tsx` passes the same file to
`FactoryProvider` so Expo Go and web load it too.

## Guardrails
- Measure to improve, never to trick.
- The paywall shows the price and how to cancel.
- Every screen is clear to a first-time user.
- Undo over confirmations.
- Errors say what happened and what to do. No blame.
- No icons or images of gems, gold, or mystic symbols.
