# AI module

`@factory/ai` sends one text input to an Expo API route and returns either a
typed teammate profile or a text answer. Calls can stream partial output; for a
structured profile, partial chunks are JSON text and become a typed object only
after the complete response arrives.

## Enable an app

Set `modules.ai` to `true` and `ai.serverUrl` to the HTTPS EAS Hosting origin in
`app.settings.ts`. When AI is off, the template uses static web output and
does not load the client package or deploy the API routes. New apps start with
AI off and a placeholder origin.

The root app layout mounts `AiProvider` only when `modules.ai` is on. A feature
calls `useAi()` and invokes `profile(text, onPartialJson?)` or
`answer(text, onPartialText?)`. Each call first opens a localized disclosure
modal explaining that the text will be sent to an AI provider. The request is
sent only after the user chooses “Send to AI”. The user can cancel without
sending anything.

## Server configuration

Copy `.env.ai.example` to a local environment file for local server work. Set
the corresponding EAS Hosting environment values for each deployment; use the
**sensitive** visibility for provider keys, the signing key, and Upstash token.
EAS Hosting cannot deploy variables marked secret, so do not select that
visibility. Keep `AI_MODULE_ENABLED=false` until the service credentials are
active. Set it to `true` when enabling the module. The selected provider and
model are configured with `AI_PROVIDER` and `AI_MODEL`; model IDs are allowlisted
with their rates in the server module.

The server issues a signed random install ID. The client stores it with
`storedValue` and identifies the same ID in RevenueCat. The server verifies the
signature, then checks RevenueCat's `premium` entitlement before applying the
higher quota. Without `REVENUECAT_PUBLIC_API_KEY` or active payments, every user gets
the free quota. An install ID can be reset by reinstalling the app; IP and
global budget guards reduce repeated identity creation and cost spikes.

Upstash holds daily request counts, per-minute IP limits, a short entitlement
cache, and the daily estimated-spend counter. Requests and generated results
are not written to the server or counters. OpenAI calls set `store: false`;
provider-side processing and retention still follow each provider's terms.
Only status and usage metadata are returned to the user. The global daily cost
guard reserves the maximum estimated request cost before contacting a model,
then reconciles the provider-reported token usage on success.

Free users receive 5 requests per UTC day and premium users receive 25. Inputs
are limited to 32,000 characters, outputs to 1,500 tokens, and aggregate
estimated provider spend to $5 per UTC day. New installs can reset an anonymous
quota, so this is abuse resistance rather than account-level identity.

## Compare providers

The comparison script sends three synthetic descriptions to both providers
with the same profile schema. It prints each result, elapsed time, token counts,
and an estimated USD cost. It does not send the descriptions to the app server
or store them there.

```sh
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... pnpm ai:compare
```

Defaults are `gpt-6-luna` and `claude-haiku-4-5-20251001`, using the public
per-token prices in effect when this script was added. If changing a model,
also set its benchmark prices in USD per million tokens with
`OPENAI_INPUT_USD_PER_MTOK`, `OPENAI_OUTPUT_USD_PER_MTOK`,
`ANTHROPIC_INPUT_USD_PER_MTOK`, and `ANTHROPIC_OUTPUT_USD_PER_MTOK`.

## Errors

`useAi().message(error)` gives localized English or Turkish text for network,
provider, validation, daily-limit, and global-budget errors. A free user who
reaches the daily limit also gets the Premium prompt; call `openPaywall()` to
show the existing paywall when payments are available.
