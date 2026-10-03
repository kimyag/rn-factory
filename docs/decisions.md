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
| 2026-10-02 | One ESLint config at the repo root; `pnpm lint` runs `eslint .` in every workspace package | New packages are linted without extra setup; same rules as the app. |
| 2026-10-02 | Git worktrees only when I ask for one; remove it after its PR is merged (replaced 2026-10-03, #40) | Branches stay switchable in the main checkout; a worktree is fine for isolated agent work. |
| 2026-10-02 | Local storage uses `expo-sqlite` (#6), not AsyncStorage or MMKV | Included in Expo Go and in native builds, one new dependency, and it reads synchronously; MMKV is not in Expo Go, AsyncStorage is async only. |
| 2026-10-02 | The storage code talks only to the Web Storage interface: `expo-sqlite/localStorage/install` on iOS and Android, the browser's `localStorage` on web | One small contract, so a later library change touches one file; the web needs no SQLite worker. |
| 2026-10-02 | API: `storedValue({ key, schema, fallback, version?, migrate? })` gives `get()` and `set()` | Two synchronous, typed methods; the zod schema gives the type and checks every read. |
| 2026-10-02 | Storage lives in its own entry, `@factory/core/storage`, through `exports` in core's `package.json` | Node loads `@factory/core` for `app.config.ts` and must not load a native module. |
| 2026-10-02 | Values are saved as `{ version, value }`; `migrate(value, fromVersion)` converts older data; invalid or newer data reads as `fallback`; reads never write | A shape change never crashes the app, and an app downgrade does not erase newer data. |
| 2026-10-02 | Stored values are read synchronously on the providers' first render, not preloaded in `FactoryProvider` | They are in place before the first frame and before the splash hides, with no loading state. |
| 2026-10-02 | The restored theme mode sets `Appearance` in an effect on the mode | Native UI matches at startup; child effects run before `FactoryProvider` hides the splash. |
| 2026-10-02 | Each stored value is defined next to its owner (`theme.mode` in `ThemeProvider`, `onboarding.completed` in `OnboardingProvider`); `@factory/ui` and `@factory/app` use the workspace's `zod` | The code that owns the state owns its key; no new package. |
| 2026-10-02 | No `expo-sqlite` config plugin | It does nothing without options. |
| 2026-10-02 | `metro.config.js` adds `wasm` to the asset extensions (removed 2026-10-03, #38) | Dev web bundles follow expo-sqlite's worker import to a `.wasm` file; the worker never runs. |
| 2026-10-02 | The root ESLint config applies the `@typescript-eslint` rules only to `.ts` and `.tsx` files | Expo's config loads that plugin only for TypeScript files, so any `.js` file, such as `metro.config.js`, failed lint. |
| 2026-10-02 | Static web pages render with default values; the browser applies stored values on load | The web is outside #6's criteria (Expo Go and native builds). |
| 2026-10-02 | Persist app state only through `@factory/core/storage` (rule in `AGENTS.md`) | The install adds a global `localStorage`; one entry point keeps types, checks, and versions. |
| 2026-10-02 | Translations without an i18n library: a typed `useText` lookup in `@factory/app` with `{name}` values and plurals, plus `expo-localization` for the device language | One new dependency; keys and values are checked by TypeScript. |
| 2026-10-02 | Translation files live next to their code: `src/text/en.ts` and `tr.ts` in each package and app | Each package owns its text; nothing central to keep in sync. |
| 2026-10-02 | Packages and apps share only the current language; each reads its own typed text set | Keys never collide and each package is checked on its own. |
| 2026-10-02 | Device language by default, English fallback; a manual choice (`setChoice`) is stored with `@factory/core/storage`; each language declares its text direction | Covers the override for settings (#4) and leaves room for right-to-left languages. |
| 2026-10-03 | Plural rules: each language file (`packages/app/src/languages/<code>.ts`) defines its own rule; no `Intl.PluralRules` | Hermes has no `Intl.PluralRules`; no polyfill dependency. |
| 2026-10-02 | `apps/<app>/eas.json` is generated from `app.settings.ts` by `pnpm eas:config`; CI fails if it is out of date | One source for per-app values; never typed twice. |
| 2026-10-02 | Daily development uses the `development` profile (dev client, `expo-dev-client`) | Matches production: embedded fonts and native modules Expo Go lacks. |
| 2026-10-02 | EAS profiles: shared base with Node 22.23.3 and pnpm 12.8.1; development (dev client, iOS simulator), preview (internal APK), production (remote versions, auto-increment) | Node 22.18+ is needed to read `app.config.ts`; build numbers managed by EAS. |
| 2026-10-02 | Store and EAS IDs are named placeholders in `app.settings.ts`; `eas.json` leaves them out until real | EAS rejects placeholder IDs; #14, #15, #31 track the accounts. |
| 2026-10-03 | `@factory/core/storage` uses expo-sqlite only under the `react-native` export condition (iOS, Android); everything else, including web and its server rendering, gets `storage.web.ts` (browser `localStorage`); `metro.config.js` removed | expo-sqlite's web worker broke the web bundles (#38); the web never needed it. |
| 2026-10-03 | pnpm uses its default isolated layout; the `node-linker=hoisted` line in `.npmrc` is removed | pnpm 12 reads `nodeLinker` only from `pnpm-workspace.yaml`, so the line was ignored; everything was tested with the isolated layout. |
| 2026-10-03 | Agents always work in a git worktree branched from main and never change the branch or files of the main checkout; the worktree is removed after its PR is merged (rule in `AGENTS.md`) | The main checkout is only for the human (testing, merging, pulling); agents switching branches there moved files under the running app and put commits on the wrong branch. |
| 2026-10-03 | Settings choices (theme, language) are radio rows that show the selection with Mark `active` / `empty` and a 150 ms fade | Selection is not achievement, so no app color; screen readers hear radio buttons. |
| 2026-10-03 | "Rate the app" opens the store's write-review page (no new dependency); on iOS it waits for the App Store app ID (#14) | Apple recommends this for an explicit button; the in-app prompt may show nothing. |
| 2026-10-03 | The app version comes from `expo-constants` (`expoConfig.version`) | Already installed and correct in Expo Go; no build number. |
| 2026-10-03 | Shared screens read app settings with `useAppSettings()` from `FactoryProvider`; `contactEmail` added to the settings | One typed source for privacy URL, contact address, store IDs, and modules. |
| 2026-10-03 | One shared error boundary wraps all root Stack route scenes; retry remounts the failed scene, and a repeated immediate failure can reset to onboarding or the feature start | Keep the navigator and providers alive during recovery while offering a safe route after repeated failure. |
| 2026-10-03 | The template app uses the existing EAS project `@kimyag/template-app` (`6d5e5f7b-1780-47e0-96e6-fc5bb04cab0d`); the CLI minimum stays at 24.9.0 | Project identity stays in app settings; verify config using `pnpm dlx eas-cli@24.9.0` without starting a build. |
| 2026-10-03 | EAS Update uses fingerprint runtimes, profile-matching channels/environments, and launch-only background checks with zero startup wait; add SDK-compatible `expo-updates` (#36) | Native changes cannot target incompatible builds; downloaded updates apply on a later launch without interrupting use. |
| 2026-10-03 | Apps pass onboarding pages from `src/feature/onboarding.tsx` (their own translation keys) to the shared `OnboardingScreen`; the route file re-exports it | Pages stay with the app's feature code and are typechecked; routes stay one line. |
| 2026-10-03 | Onboarding pages change by swipe (horizontal `FlatList`, no dependency) and by the Next button | Swipe is expected on phones; screen readers use the buttons. |
| 2026-10-03 | Onboarding images live in each app's `assets/onboarding/` and are passed with `require()` | Content belongs to the app; packages hold no app images. |
| 2026-10-03 | Finishing onboarding turns all Marks `complete` (400 ms, 150 ms with reduced motion) before the feature opens; Skip saves the flag with no motion | Finishing is the achievement moment; skipping is not. |
| 2026-10-03 | Empty states: one short line saying what will appear, plus one action to add the first item if possible; no illustrations by default | Clear for first-time users without decoration. |
