# Payments

`@factory/payments` puts RevenueCat behind a small API. Only its private
`src/vendor.ts` imports the SDK, and `src/payments.ts` loads that file with
`import()` on first use.

## When payments run

Payments are active only when all three are true:

- `modules.payments` is on in `app.settings.ts`.
- The platform is iOS or Android. Payments are off on the web.
- The API key for the build is real, not a `NAME_PLACEHOLDER`.

Otherwise the SDK is never loaded or configured: `usePremium()` reports
`available: false` and `status: 'inactive'`, Settings hides its Premium section,
and the paywall says purchases are not available.

Every app installs the SDK, so its native code is in every build. An app with
`modules.payments` off blocks the Android billing permission in its app config
(`blockedAndroidPermissions` in `@factory/core`). The permission comes from
Google's Play Billing library, a dependency of the RevenueCat SDK.

## Keys

| Setting | Used in | Until it is real |
|---|---|---|
| `payments.revenueCatTestStoreApiKey` (`test_…`) | Development builds only | Payments are inactive in development |
| `payments.revenueCatIosApiKey` (`appl_…`) | iOS release builds | Payments are inactive on iOS (#14, #16) |
| `payments.revenueCatAndroidApiKey` (`goog_…`) | Android release builds | Payments are inactive on Android (#15, #16) |

The SDK crashes a release build on purpose when it gets a Test Store key. The
`preview` and `production` EAS profiles are release builds, so the Test Store
key is selected only when `__DEV__` is true, and the settings schema rejects a
`test_` key in a store key field. A development build with a placeholder Test
Store key falls back to the store key of its platform.

## RevenueCat dashboard

The app holds no product IDs. It expects:

- one entitlement with the identifier `premium`;
- a current offering with any of the monthly, annual, and lifetime packages.

The paywall lists those packages in that order. A package of another type is
not listed, because its billing period could not be stated.

## In an app

Every app needs these, also with `modules.payments` off, because the shared
Settings screen reads the payments state:

- the `payments` block with the three keys in `app.settings.ts`;
- `PaymentsProvider` in `src/app/_layout.tsx`, inside `FactoryProvider`;
- `blockedAndroidPermissions(settings)` merged into `android.blockedPermissions`
  in `app.config.ts`.

An app with payments on also registers the `(paywall)/paywall` route as a modal.
The route file re-exports `src/feature/paywall.tsx`, which passes the app's own
title and one line about what premium adds (`paywall.title`, `paywall.body`) to
the shared `PaywallScreen`.

A screen checks access with `usePremium()`:

```tsx
const { status, openPaywall } = usePremium();

if (status === 'active') {
  // show the premium feature
} else if (status === 'inactive') {
  // show the free version; call openPaywall() when the user asks for the feature
}
```

`status` is `'loading'` until the entitlement is known, so a screen does not
show the paywall entry before it knows. The paywall opens only on request: from
a premium feature, and from the "See plans" row in Settings while not premium.

`usePayments()` gives the full API: `status`, `plans()`, `purchase(plan)`, and
`restore()`. `useRestore()` adds the label and the result line for a restore
button; Settings and the paywall both use it.

## Paywall rules

- Every plan shows its price and billing period. The price is the store's
  regular price; an introductory offer is never shown as the price.
- No plan is selected until the user picks one. Continue stays disabled until then.
- The way to cancel is always stated under the plans, for the store of the device.
- Close is at the top of the screen in every state, and back also closes it.
- A cancelled purchase shows no message. A failed one says so in one line.
- No new analytics events are recorded.

Before an App Store submission the paywall also needs a Terms of use link
next to the privacy policy link (#14).

## Checks

```bash
pnpm typecheck
pnpm lint
node --test packages/core/src/payments-config.test.ts packages/payments/src/payments.test.ts
pnpm --filter template-app start
```

Adding the SDK changed the native code, so purchases need a development build
made after this module was added. With a real Test Store key in
`app.settings.ts`, open Settings, then "See plans": the Test Store shows its own
sheet to simulate a successful, failed, or cancelled purchase.
