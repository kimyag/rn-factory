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
