# Switch Companion

Temporary name, store package IDs and URL scheme come from `app.settings.ts`.
The package name is the workspace selector, and the folder is the scaffold slug.
AI/analytics configuration remains placeholders; external setup is tracked in #94.

Initialize EAS manually (the scaffold did not initialize it):

```bash
cd apps/switch-companion
pnpm dlx eas-cli@24.9.0 project:init
```

Copy the owner/project ID into `app.settings.ts`, then run `pnpm eas:config`
from the workspace root. Build the iOS simulator dev client from the app folder:
`pnpm dlx eas-cli@24.9.0 build --profile development --platform ios`.

## Local task data

`src/feature/task-store.ts` stores tasks, dumps, loose ends and the explicit
current task ID together through `storedValue` from `@factory/core/storage`.
Dates are Unix milliseconds. Version 1 contains the record collections; version 2
adds the current task choice. Migration preserves an existing valid choice, or
uses the first open task. Unknown future versions and invalid data use the shared
storage fallback. A migrated value is written in version 2 on the next change.

Adding a task selects it. Swiping saves the visible card after native paging
settles; Previous/Next provide the same choice without a gesture. Archiving
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
