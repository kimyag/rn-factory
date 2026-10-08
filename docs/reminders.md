# Shared reminders

Apps can schedule local reminders without a backend through `@factory/reminders`.
The package wraps `expo-notifications`; apps call its typed API without importing the Expo library.

Install the SDK-matched `expo-notifications` version in the app and set
`modules.reminders` to `true` in `app.settings.ts`. The app config adds the
notifications plugin while the module is enabled and blocks Android's boot
receiver permission while it is disabled. A new native build is required after
adding the package or changing its native configuration.

The shared Settings screen shows one daily reminder with an editable 24-hour
time and an on/off switch. It stores the time and scheduled ID with
`storedValue`. The explanation is visible before permission is requested.
Permission is requested only after the user turns the reminder on; a denied
request leaves the switch off. Changing an enabled reminder's time schedules
the new time before canceling the old notification.

Apps can build their own reminder UI for multiple reminders. The shared API is:

```ts
requestReminderPermission(channelName: string): Promise<boolean>
scheduleReminder(input: ReminderInput): Promise<string>
cancelReminder(id: string): Promise<void>
listReminders(): Promise<ScheduledReminder[]>
```

`ReminderInput` has a title, body, and either a one-time `Date` trigger or a
daily hour and minute trigger. An optional key gives an app-managed reminder a
stable identifier. `listReminders()` returns only notifications scheduled
through this package, with their ID, key, title, and body. Call the permission
function from an explicit user action; scheduling does not prompt by itself.
