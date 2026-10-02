# Decisions

One line per decision. Newest at the bottom.

| Date | Decision | Reason |
|---|---|---|
| 2026-10-02 | pnpm monorepo, Expo managed workflow with CNG | No native folders to maintain; one toolchain for all apps. |
| 2026-10-02 | Each new app is one settings file plus one feature folder | Goal of the boilerplate: new apps with minimal code. |
| 2026-10-02 | `node_modules` not tracked; root `.gitignore` added | Keep dependencies out of git history. |
| 2026-10-02 | Lint with `eslint` 9 and `eslint-config-expo` in CI | Lint must pass on every PR; Expo's lint plugins do not support ESLint 10 yet. |
| 2026-10-02 | Root `AGENTS.md` is the only rules file; app-level rules files removed | One source of rules for every agent. |
| 2026-10-02 | Every new dependency needs approval | Keep the boilerplate small. |
| 2026-10-02 | Packages ship TypeScript source; Node 22.18+ required | No build step; Node strips types when `app.config.ts` loads `@factory/core`. |
| 2026-10-02 | App settings validated with `zod`; `AppSettings` type derived from the schema | One source for the type and the runtime check. |
| 2026-10-02 | Lint for `packages/*` tracked as its own issue (#20) | `expo lint` only covers apps; the gap must not stay open. |
| 2026-10-02 | React Native patterns live in `.claude/skills/react-native/SKILL.md`; `AGENTS.md` keeps short must-rules and points to it | Short `AGENTS.md`; the skill loads only for UI work, and agents without skill support still read the file. |
| 2026-10-02 | The skill covers only what the Expo plugin does not; list items use `StyleSheet`, overriding the plugin's inline-style default | No duplicate guidance; inline objects in rows are rebuilt on every render. |
| 2026-10-02 | Theme token and translation examples join the skill in #3 and #7 | Do not invent APIs before those issues decide them. |
| 2026-10-02 | Main app navigation is a stack; settings opens from a header button; app settings do not choose the layout | One feature per app; an app that needs tabs adds them in its own feature group. |
| 2026-10-02 | Shared screens live in `@factory/screens`; apps mount them with one-line route files | Written once; peer dependencies keep a single copy of React, React Native, and Expo Router. |
| 2026-10-02 | Onboarding is gated with `Stack.Protected` and an in-memory flag | Uses the real mechanism now; #6 only makes the flag persist. |
| 2026-10-02 | App code lives in `src/feature/`; `src/app/` holds only thin route files | One clear rule for where code goes. |
| 2026-10-02 | Removed template-only `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`; kept `expo-web-browser` | Nothing uses them; `expo-web-browser` opens the privacy link in #4. |
| 2026-10-02 | Placeholder UI text is literal English until #7 | No translation API yet; #7 lists the strings to replace. |
| 2026-10-02 | Each app owns its `_layout.tsx` and `Stack`; `@factory/app` gives `<FactoryProvider settings>` (theme, navigation theme, fonts, onboarding guard); no shared root layout | The app controls its navigation; shared setup stays one typed component. |
| 2026-10-02 | House style for every app: neutrals, 4 px grid, 2 px corners, chamfered primary Button, 150/400 ms motion (#25) | One look across apps; values in `packages/ui/DESIGN.md`. |
| 2026-10-02 | The app color (`appColor: { light, dark }`) is only for achievement; the primary Button is ink; tokens `paper`, `ink`, `inkMuted`, `line`, `achievement`, `onAchievement` | Keeps the app color meaningful, and the names show the rule. |
| 2026-10-02 | Settings validation checks app color contrast: 3:1 on paper and 4.5:1 for the dot on it, in both modes | Bad colors stop the config instead of shipping. |
| 2026-10-02 | Font roles `title` and `mono`, each `'system'` or font files in the app folder, embedded with `expo-font` and also loaded at runtime | Brand type without files in packages; works in builds, Expo Go, and web. |
| 2026-10-02 | Components are `Screen`, `Text`, `Button`, `Mark`; add one only when the same UI appears twice | Keep the design system small. |
| 2026-10-02 | Styles come from `createStyles((theme) => …)`; the light/dark override is in memory until #6 and also sets `Appearance` on iOS and Android | Static styles per mode; native UI matches the app. |
| 2026-10-02 | Added `react-native-svg` for the chamfered Button and the Mark | One drawing path for iOS, Android, and web. |
| 2026-10-02 | Keep platform push/back transitions; 150 ms fades inside screens | Navigation feels native. |
