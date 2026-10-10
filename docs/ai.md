# AI module

`@factory/ai` sends text and structured dump requests to Expo API routes. It
returns typed teammate profiles, text answers, transcriptions, and validated
task-dump splits.

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

`ai.dailyLimits` in each `app.settings.ts` configures free and premium requests
per UTC day. Template apps default to 5 and 25; Switch Companion sets 60 and
25. Each endpoint call costs one request. Inputs
are limited to 32,000 characters, outputs to 1,500 tokens, and aggregate
estimated provider spend to $5 per UTC day. New installs can reset an anonymous
quota, so this is abuse resistance rather than account-level identity.

## Transcription and dump splitting

Set `GROQ_API_KEY` as a sensitive EAS Hosting environment value for
transcription. The proxy uses Groq's OpenAI-compatible audio transcription API
with `whisper-large-v3-turbo`; audio is limited to 25 MB and is not persisted by
the server. The client should delete its local recording only after transcript
text is saved locally.

Dump splitting uses the server's OpenAI-compatible configuration. For
Switch Companion, use `AI_PROVIDER=openai-compatible`,
`AI_BASE_URL=https://openrouter.ai/api/v1`,
`AI_MODEL=openrouter/free`, and `OPENAI_COMPATIBLE_API_KEY`. The free router
selects an available free model that supports structured output. The response
schema is validated before returning `whereIWas`, `looseEnds`, and `nextStep`.
The prompt preserves the detected English, Turkish, or Farsi language. Each
transcription and split request consumes one configured daily request.

## Compare providers

The comparison script sends three synthetic descriptions to OpenAI and Anthropic
with the same profile schema. It prints each result, elapsed time, token counts,
and an estimated USD cost. Results must pass the server's profile schema; incomplete
responses are rejected. It does not send the descriptions to the app server
or store them there.

```sh
node --env-file=apps/template-app/.env.local scripts/compare-ai-providers.mjs
```

For direct APIs, create the gitignored environment file from `.env.ai.example`
and replace `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` with active credentials.
The default comparison needs only those two provider keys. To include the compatible
provider, set `AI_COMPARE_PROVIDERS=openai,anthropic,openai-compatible` and provide its key.
All selected provider keys and prices are checked before any request is sent.
Each provider request has a 60-second timeout; errors report HTTP status without
printing provider response bodies.

Defaults are `gpt-6-luna` and `claude-haiku-4-5-20251001`, using the public
per-token prices in effect when this script was added. If changing a model,
also set its benchmark prices in USD per million tokens with
`OPENAI_INPUT_USD_PER_MTOK`, `OPENAI_OUTPUT_USD_PER_MTOK`,
`ANTHROPIC_INPUT_USD_PER_MTOK`, `ANTHROPIC_OUTPUT_USD_PER_MTOK`,
`OPENAI_COMPATIBLE_INPUT_USD_PER_MTOK`, and
`OPENAI_COMPATIBLE_OUTPUT_USD_PER_MTOK`. The compatible provider defaults to
OpenRouter at `https://openrouter.ai/api/v1` with model
`openai/gpt-oss-20b:free` and zero token prices.

### Compare through OpenRouter

The approved route for #59 is free OpenRouter models, using the key already in Switch
Companion's gitignored environment file. The key is read locally; neither the
file nor the key belongs in git or benchmark output.

```sh
AI_COMPARE_ROUTE=openrouter OPENROUTER_FREE_MODELS=nvidia/nemotron-3-super-120b-a12b:free,liquid/lfm-2.5-2.6b:free node --env-file=apps/switch-companion/.env.local scripts/compare-ai-providers.mjs
```

Free mode verifies that all selected IDs appear in OpenRouter's live catalog
with zero input/output pricing and structured-output support before inference.
It sends the same samples and strict schema through OpenRouter, using only
`OPENAI_COMPATIBLE_API_KEY`. Results report token counts, latency, and zero
estimated token cost. A model failure is recorded without discarding successful
results from the other model; any failure makes the command exit unsuccessfully.
There are no paid-model fallbacks.

The [live comparison results](./ai-comparison.json) on 2026-10-10 selected
`nvidia/nemotron-3-super-120b-a12b:free`:

| Model | Valid profiles | Observed outcome | Estimated token cost |
| --- | --- | --- | --- |
| NVIDIA Nemotron 3 Super 120B A12B free | 3/3 | 2.5–10.9 seconds; 262 input and 2,060 output tokens | $0 |
| Liquid LFM 2.5 2.6B free | 1/3 | Two truncated responses at the 1,500-token cap; successful sample took 2.5 seconds | $0 |

This is a small synthetic comparison, not a broad quality or availability guarantee.
The command exits with status 1 because Liquid failed two samples; the selected
Nemotron model passed all three. Free endpoints have provider rate limits and
availability constraints.

### Paid OpenAI/Anthropic comparison

With `AI_COMPARE_ROUTE=openrouter` and no `OPENROUTER_FREE_MODELS`, the script
compares `openai/gpt-6-luna` and `anthropic/claude-haiku-4.5` through OpenRouter.
This mode requires paid-model access. Direct OpenAI or Anthropic keys are not used.

On 2026-10-10, the [OpenRouter catalog](https://openrouter.ai/api/v1/models)
listed input/output prices of $0.10/$0.50 per million tokens for GPT-6 Luna
and $1/$5 for Claude Haiku 4.5. These are the script's default estimates;
they exclude account fees and cache discounts. To override models, use
`OPENROUTER_OPENAI_MODEL` or `OPENROUTER_ANTHROPIC_MODEL` and supply that
model's `OPENROUTER_OPENAI_INPUT_USD_PER_MTOK` /
`OPENROUTER_OPENAI_OUTPUT_USD_PER_MTOK` or
`OPENROUTER_ANTHROPIC_INPUT_USD_PER_MTOK` /
`OPENROUTER_ANTHROPIC_OUTPUT_USD_PER_MTOK` values.

### Template App activation (#59)

Template App remains disabled until its server configuration is ready. The
approved activation scope is a free-model comparison through OpenRouter,
followed by model selection and EAS Hosting deployment. External setup is tracked in
[#108](https://github.com/kimyag/rn-factory/issues/108); RevenueCat account setup
is tracked in [#16](https://github.com/kimyag/rn-factory/issues/16).

1. The selected model is `nvidia/nemotron-3-super-120b-a12b:free`. Set
   `AI_PROVIDER=openai-compatible`, `AI_BASE_URL=https://openrouter.ai/api/v1`,
   `AI_MODEL=nvidia/nemotron-3-super-120b-a12b:free`, and both
   `AI_INPUT_USD_PER_MTOK` / `AI_OUTPUT_USD_PER_MTOK` to zero. Set Template App's public
   `ai.openModelBaseUrl` and `ai.openModel` to the same base URL and model.
2. Generate an app-specific random `AI_SIGNING_KEY` and configure Upstash so
   Template App's counters are isolated from Switch Companion's. Premium
   verification requires its RevenueCat public key; free access can be activated
   separately if premium setup is deferred.
3. Configure `OPENAI_COMPATIBLE_API_KEY`, signing key, Upstash URL/token, RevenueCat
   key, model, and `AI_MODULE_ENABLED=true` as sensitive EAS environment variables.
4. Once credentials are ready, set `modules.ai: true` for server export in the
   activation worktree. Export with `pnpm --filter template-app exec expo export
   --platform web`, then run `eas deploy --environment preview` from
   `apps/template-app`. Test session creation, structured generation, unauthorized
   requests, and free/premium quota handling on the preview URL.
5. After preview passes, configure the production environment and deploy. Set
   `ai.serverUrl` to the production HTTPS origin, re-export and deploy with that
   configuration, and verify the production service before making the PR ready.
   Publish native builds or app updates separately, following the runtime and
   preview validation rules in `AGENTS.md`.

Keep signed identities and quota counters isolated across apps. Passing
comparison-script tests does not complete provider comparison or activation.

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
