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
