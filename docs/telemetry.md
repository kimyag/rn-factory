# Crash reports and opt-in analytics

`@factory/core/telemetry` owns the small vendor-neutral wrapper. Only its private
adapter imports Sentry/PostHog; the settings/config barrel never loads SDKs.
`FactoryProvider` supplies consent and reporting through `useTelemetry()`.
Each app connects `reportCrash` to its shared route boundary's `onError` hook.

`modules.crashReports` and `modules.analytics` are independent. Both are enabled
in the template, but named placeholder credentials prevent SDK initialization
and network requests. Configure accounts in [#45](https://github.com/kimyag/rn-factory/issues/45).

Analytics asks once at the end of onboarding, with equal secondary Share / Don't
share buttons and no selection. The nullable choice persists through
`storedValue`; either choice completes onboarding. A settings switch changes it
later. Existing installations that have completed onboarding do not get another
onboarding; analytics stays off until they enable the settings switch.

The allowlisted events are `onboarding_completed`, `theme_changed`, and
`language_changed`, with a random installation ID, session ID and SDK metadata.
No values chosen, identity, arbitrary event properties, automatic screen/tap or
lifecycle events, surveys, feature flags, location enrichment, replay or
performance tracing are collected. This is pseudonymous, not anonymous.
Use `track()` with a named event when extending the allowlist; update tests,
consent copy and disclosures when collection changes.

PostHog's custom storage persists its identity and event queue through
`storedValue`; no direct file-system or AsyncStorage dependency is added.
Withdrawal blocks future transport calls (including retries), deletes the
persisted queue/ID, and invalidates old clients even after a new opt-in. Analytics
shutdown is deliberately not called because it flushes. A request already sent
before withdrawal cannot be recalled; withdrawal does not delete prior server
data. Apply the account's retention/deletion policy for that data.

Crashes do not wait for this choice. Sentry reports error stacks and basic
app/OS diagnostics, without identity, requests, breadcrumbs, arbitrary extra
data, tags, fingerprints, error-message values, tracing, session metrics or replay.
Do not place user data in error types, function names, filenames or stacks. Native crash data is handled by the
native SDK; verify actual payloads and disclosures when configuring the account.
Native initialization happens only through the guarded JS `Sentry.init` call:
the installed Android manifest disables native auto-init, and the Expo plugins
configure upload build scripts, not runtime startup. No SDK starts with modules
off or placeholder keys. Crashes before this JS initialization are not covered.

## iOS privacy

The app config declares crash/other diagnostic data for app functionality and
linked pseudonymous device IDs/product interactions for analytics; tracking is
false with no tracking domains. Required reasons are derived from
`expo-application` (C617.1), `expo-device` (35F9.1), and the
[Sentry Cocoa 8.58.0 manifest](https://github.com/getsentry/sentry-cocoa/blob/8.58.0/Sources/Resources/PrivacyInfo.xcprivacy)
(CA92.1, 35F9.1, C617.1). The installed React Native Sentry podspec selects that
Cocoa version. SDK upgrades must recheck reasons and collection. Sentry's native
manifest also declares performance diagnostics; its tracing/app-start/frame/hang
collection is disabled here. Reconcile the aggregated archive privacy report
before store submission (tracked in #45), not just this source configuration.

No ATT permission is requested because the setup excludes cross-company
advertising/tracking and IDFA. Voluntary analytics consent is separate from
[Apple's ATT definition](https://developer.apple.com/app-store/user-privacy-and-data-use/).
Do not add advertising, cross-company identity linking or vendor repurposing
without reassessing ATT, consent and the privacy policy.

## Credentials, source maps and verification

Public DSN/project keys and the chosen PostHog host belong in app settings.
Sentry organization/project placeholders also live there. The native Sentry
upload plugin is included only when crash reports and real Sentry settings are
configured, so template builds do not attempt an upload with placeholders.
Store `SENTRY_AUTH_TOKEN` in EAS/CI secrets, never in app settings or git.
The Metro integration adds source-map/debug-ID support without component annotations.

After an explicitly authorized EAS Update publish, from the app folder upload
that release's maps with `pnpm exec sentry-expo-upload-sourcemaps dist` when Sentry
is configured. Do not upload placeholder projects. Native builds also need real
upload credentials before symbolication can be verified. The optional Sentry CLI
install script is disabled by pnpm policy; its packaged platform binary is used.

From the issue worktree:

```bash
pnpm typecheck
pnpm lint
node --test packages/core/src/telemetry.test.ts packages/screens/src/error-recovery.test.ts
pnpm eas:config --check
pnpm --filter template-app start --web --port 8094
```

On a fresh browser/app installation, Continue reveals the equal consent choices.
Verify both actions complete onboarding, reopening does not ask again, and the
settings switch persists in English and Turkish. With placeholders neither SDK
sends data. With real accounts, verify report delivery independently of consent,
opt-out/offline queue behavior, no automatic collection and source maps (#45).
No intentional test-crash trigger is shipped.
