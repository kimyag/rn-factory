# AGENTS.md

The must-rules for all agents. Read it before every task. UI patterns are in `.claude/skills/react-native/SKILL.md`.

## Stack
- pnpm monorepo, TypeScript strict, Node 22.18+ (`.nvmrc`).
- Packages ship TypeScript source, no build step.
- Expo managed workflow with Continuous Native Generation (CNG), Expo Router.
- Expo changes every SDK. Before using an Expo API, read the docs for the SDK
  major in the app's `package.json`: `https://docs.expo.dev/versions/v<major>.0.0/`.
- Goal: each new app is one settings file plus one feature folder.

## Folder map
- `apps/<app>/` – one app: `app.settings.ts` and its feature folder `src/feature/`.
  `src/app/` holds the app's `_layout.tsx` and one-line route files; `src/text/` its translations.
  Onboarding pages: `src/feature/onboarding.tsx` (1–4 pages), images in `assets/onboarding/`.
- `packages/core` – `@factory/core`: app settings schema and shared logic.
- `packages/app` – `@factory/app`: `FactoryProvider` (theme, navigation theme,
  fonts, language, onboarding guard) and `useText` for translations.
- `packages/screens` – `@factory/screens`: onboarding and settings screens.
- `packages/ui` – `@factory/ui`: tokens and components; see `packages/ui/DESIGN.md`.
- `packages/payments` – RevenueCat module, on or off from app settings.
- `docs/decisions.md` – decision log.
- `.github/` – issue and PR templates, CI.

## Commands
```bash
pnpm install                    # install
pnpm --filter <app> start       # start the dev server
pnpm typecheck                  # typecheck
pnpm lint                       # lint
pnpm eas:config                 # write apps/*/eas.json from app settings (never edit eas.json)
```
Daily development uses the `development` build (dev client): build it once with
`npx eas-cli build --profile development --platform android` (or `ios` for the simulator), then `pnpm --filter <app> start`.

## Workflow
- One issue, one branch, one PR. The PR says `Closes #<issue>`.
- Branch: `<type>/<issue-number>-<short-slug>`, e.g. `feat/7-translations`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `ci:`.
- Typecheck and lint must pass before a PR is ready.
- When I make a decision, add one line to `docs/decisions.md`.

## Code rules
- Add dependencies with `npx expo install` inside the app folder, or
  `pnpm --filter @factory/<pkg> add` for a package.
  Ask me before you add any new dependency.
- Relative imports in `packages/*`, `app.config.ts`, and `app.settings.ts`
  use the `.ts` extension. Node loads these files directly.
- Do not create or edit `ios/` or `android/`. Use app config and config plugins.
- TypeScript strict. No `any`, no `@ts-ignore`.
- Before UI work in `apps/*`, `packages/ui`, or `packages/screens`, read
  `.claude/skills/react-native/SKILL.md` and follow it.
- Long lists use `FlatList`, never `ScrollView` with `map`.
- Persist app state only with `storedValue` from `@factory/core/storage`, never with `localStorage` or a storage library directly.
- No hardcoded colors, spacing, or user-facing text. Use theme tokens and
  translation keys.
- No `console.log` in commits. No comments that repeat what the code says.
- Remove Expo template example screens and assets that we do not use.
- Change only the files the task needs.

## Work rules
- Read only the files the task needs. Do not scan the whole repo.
- Subagents: use a small, fast model for search and file reading. Use the
  strongest model only for architecture decisions and hard bugs.
- If a task needs something that is not available yet (store accounts, API
  keys, product IDs), use a clearly named placeholder in the app settings
  (e.g. `REVENUECAT_IOS_API_KEY_PLACEHOLDER`), open a GitHub issue with the
  label `blocked-external`, and continue. Never stop a task for this.
- Before you write code, list the decisions I must make, with 2 options each
  and a one-line reason. Wait for my answer.
- At the end of each task: a summary of max 5 lines and the exact commands
  to check the result.

- Do not use git worktrees unless I ask for one. If I ask, remove the worktree after its PR is merged.
