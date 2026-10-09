# Maestro flows

Maestro drives the app on a real Android phone, so a UI change is checked in the real
app and leaves screenshots. It is a tool on your Mac, not a project dependency.

## Install

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro --version
```

Java 17 or newer is needed. The phone needs USB debugging on and must be the only
device `adb devices` lists.

## Run

Start the dev server first, with the development build installed on the phone:

```bash
pnpm --filter template-app start
pnpm maestro                          # every flow
pnpm maestro settings                 # one flow, by file name
pnpm maestro settings --lang tr --theme light
pnpm maestro --app my-app --server http://192.168.1.5:8081
pnpm maestro --preview settings       # installed preview build; no Metro/dev client
```

By default each flow clears the app's data first, so it starts like a fresh install and
opens the app from the dev server through the dev client link. **A run wipes the app's
data on the phone**: do not run it while someone else is testing there.

`--preview` runs the flow against the installed standalone preview build. It
does not check or connect to Metro and does not open the development client.
The runner prepares a temporary flow copy that launches the app directly. Use
this mode for release-like checks such as performance runs; it does not test
development-client behavior.

Screenshots go to `maestro-screenshots/<app>/<time>/`, which git ignores. Attach the
ones that show your change to the PR.

## Flows

| Flow | Covers |
|---|---|
| `onboarding-pages` | Next, Get started, the analytics question, landing on the feature screen |
| `onboarding-skip` | Skip jumps to the analytics question, which must be answered |
| `settings` | Theme and language, set with `--theme` and `--lang` |
| `payments` | Paywall, a Test Store purchase, restore |

Shared flows live in `maestro/`; `maestro/subflows/` holds the steps they share. An app's
own feature flows go in `apps/<app>/.maestro/` and run with the same command.

Flows find elements by `testID`, not by text, so they work in every language. Give new
UI a `testID` (`testID="area-thing"`), and use it in the flow.

Theme and language are set by tapping them in Settings: the app has no launch argument
or link for them.

## Known limits

- The payments flow taps the Test Store's purchase sheet by its button text, taken from
  RevenueCat's docs. If a run shows different wording, fix `maestro/payments.yaml`.
- The flows assume the template's three onboarding pages.
- Android only; iOS comes with the Apple account (#14).
