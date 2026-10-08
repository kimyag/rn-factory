# AI module

`@factory/ai` sends one text input to an Expo API route and returns either a
typed teammate profile or a text answer. Calls can stream partial output; for a
structured profile, partial chunks are JSON text and become a typed object only
after the complete response arrives.

## Enable an app

Set `modules.ai` to `true` and `ai.serverUrl` to the HTTPS EAS Hosting origin in
`app.settings.ts`. For the OpenAI-compatible provider, also set
`ai.openModelBaseUrl` and `ai.openModel`. When AI is off, the template uses static web output and
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
active. Set it to `true` when enabling the module. `AI_PROVIDER` and `AI_MODEL`
select the server provider. For `openai-compatible`, set `AI_BASE_URL`,
`AI_MODEL`, `AI_INPUT_USD_PER_MTOK`, and `AI_OUTPUT_USD_PER_MTOK` in the server
environment, plus `OPENAI_COMPATIBLE_API_KEY`. The public `ai.openModelBaseUrl`
and `ai.openModel` values are sent with each request and must match the trusted
server values; mismatches are rejected before provider access. The API key never
leaves the server. The HTTPS base URL is deployment-controlled, and redirects
are rejected so a provider cannot forward the authorization header elsewhere.

OpenAI-compatible calls use the Chat Completions API with JSON mode for profile
generation. The server parses the JSON and validates it against the profile
schema; if JSON parsing or schema validation fails, it makes one correction
attempt and validates once more. Profile requests reserve quota for two calls
and settle against the combined usage. Profile streaming sends only the final
validated result.

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
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_COMPATIBLE_API_KEY=... pnpm ai:compare
```

Defaults are `gpt-6-luna` and `claude-haiku-4-5-20251001`, using the public
per-token prices in effect when this script was added. If changing a model,
also set its benchmark prices in USD per million tokens with
`OPENAI_INPUT_USD_PER_MTOK`, `OPENAI_OUTPUT_USD_PER_MTOK`,
`ANTHROPIC_INPUT_USD_PER_MTOK`, `ANTHROPIC_OUTPUT_USD_PER_MTOK`,
`OPENAI_COMPATIBLE_INPUT_USD_PER_MTOK`, and
`OPENAI_COMPATIBLE_OUTPUT_USD_PER_MTOK`. The compatible provider defaults to
OpenRouter at `https://openrouter.ai/api/v1` with model
`openai/gpt-oss-20b:free` and zero token prices.

### OpenRouter availability and data handling

OpenRouter lists [gpt-oss-20b:free](https://openrouter.ai/openai/gpt-oss-20b:free)
at no token charge and notes that free endpoints are rate limited. On 2026-10-08,
its [live endpoint list](https://openrouter.ai/api/v1/models/openai/gpt-oss-20b%3Afree/endpoints)
returned no active providers. Therefore no active free host for this model could
be confirmed on that date; recheck the linked catalog and endpoint list before
relying on free access. For comparison, [Groq lists gpt-oss-20b as a paid model](https://console.groq.com/docs/models).

OpenRouter says its prompt and completion content logging is off by default and
can be enabled in the account's Observability settings. Turning it off excludes
content from OpenRouter's own request logs. OpenRouter still stores request
metadata such as token counts and latency. Its account settings also control
whether providers that train on prompts can receive requests, with separate
settings for free and paid models. These training controls do not define
provider retention. The free endpoint list was empty when checked, so no
downstream provider or its specific policies or retention duration could be
identified. Turning off OpenRouter content logging does not disable downstream
provider retention or metadata collection. Review [OpenRouter's privacy policy](https://openrouter.ai/privacy/),
[provider logging guidance](https://openrouter.ai/docs/guides/privacy/provider-logging),
and [data collection controls](https://openrouter.ai/docs/guides/privacy/data-collection)
when choosing an endpoint.

## Errors

`useAi().message(error)` gives localized English or Turkish text for network,
provider, validation, daily-limit, and global-budget errors. A free user who
reaches the daily limit also gets the Premium prompt; call `openPaywall()` to
show the existing paywall when payments are available.
