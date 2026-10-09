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

## Local task data

`src/feature/task-store.ts` stores tasks, dumps, loose ends and the explicit
current task ID together through `storedValue` from `@factory/core/storage`.
Dates are Unix milliseconds. Version 1 contains the record collections; version 2
adds the current task choice. Migration preserves an existing valid choice, or
uses the first open task. Unknown future versions and invalid data use the shared
storage fallback. A migrated value is written in version 2 on the next change.

Adding a task selects it. Swiping saves the visible card after native paging
settles; Previous/Next save the same choice before the pager scrolls. The stored
current task ID is the single selection source, and selecting it again does not
publish another snapshot. Horizontal cards and the recycler use an independently
measured viewport height to prevent layout measurement feedback. Archiving
retains linked data and selects the nearest remaining card. Undo restores and
selects the archived task, and remains until the next archive or screen restart.
No archive confirmation or time limit. These interaction defaults can be changed
before device validation.

## Check from the workspace root

```bash
pnpm typecheck
pnpm lint
pnpm --filter switch-companion test
pnpm --filter switch-companion exec expo export --platform ios --platform android
pnpm --filter switch-companion start
```

After the device is explicitly available:
`pnpm maestro task-cards --app switch-companion` (or add `--preview` for an
installed preview build). The flow covers add, swipe, archive,
undo, accessible paging and returning to empty. It was authored but not run;
no device runs were authorized for #86/#87. Touch, cancellation, vertical title
scrolling, reduced motion and screen-reader behavior need device validation.
