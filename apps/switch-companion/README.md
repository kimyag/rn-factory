# Switch Companion

Temporary display name, store package IDs and URL scheme come from `app.settings.ts`.
The package name is the workspace selector; the folder is the scaffold slug.
AI and analytics are enabled with placeholder service configuration tracked in #94.
Reminders and payments are disabled.

The placeholder Mark and Newsreader S assets are generated from app settings.
After changing the name or colors, run `pnpm app:assets switch-companion` from the
workspace root. Final icons and splash artwork can replace the PNGs at those same
paths without changing code. Do not regenerate after replacing them manually.

The EAS project was initialized manually and is linked only through
`app.settings.ts`. Regenerate build profiles with `pnpm eas:config` from the
workspace root. Build the iOS simulator development client from the app folder:

```bash
pnpm dlx eas-cli@24.9.0 build --profile development --platform ios
```

Check from the workspace root:

```bash
pnpm typecheck
pnpm lint
pnpm eas:config --check
pnpm --filter switch-companion start
```

No device or Maestro runs were performed for the scaffold PR.
