# Anthropic AI Import Cost research

Research date: 2026-08-23

This note answers one narrow question: what Plan Eat Repeat needs to estimate the Anthropic cost of its current AI import call. It uses Anthropic documentation and the exact AI SDK packages installed in the repo. Prices and APIs can change, so the date matters.

## Short answer

Plan Eat Repeat does not need the Anthropic Usage and Cost Admin API for the first version. It can calculate a useful per-import estimate from the usage returned by `generateText`, then attach that estimate to the Household and User already known by the import mutation.

For the current `claude-opus-4-8` call with no prompt caching, thinking, fast mode, data-residency override, tools, or batch processing, the estimate is:

```text
estimated USD = uncached input tokens * 5 / 1,000,000
              + output tokens         * 25 / 1,000,000
```

Images already count as input tokens. Reasoning, if enabled later, already counts inside output tokens. Neither should be added a second time.

Keep the raw token counts and the calculated USD amount. Treat the amount as an estimate, not an invoice. That is accurate enough to answer the product question: "Can I afford to keep paying for these imports?"

## The current call

The app uses `generateText` from AI SDK 7.0.16 with `@ai-sdk/anthropic` 4.0.8. The configured model defaults to `claude-opus-4-8`. It asks for a structured object and sends either text or one to four images. It does not set `maxRetries`, `maxOutputTokens`, `providerOptions`, tools, or thinking. See [`extractRecipe.ts`](../../apps/web/src/server/ai/extractRecipe.ts), [`env.ts`](../../apps/web/src/env.ts), and the lockfile entries for [AI SDK](../../pnpm-lock.yaml) and [the Anthropic provider](../../pnpm-lock.yaml).

`Output.object` becomes Anthropic's native JSON structured-output request in the installed provider. Anthropic adds a format instruction to the prompt and bills the extra instruction as ordinary input tokens. The published docs describe no other structured-output charge. [Anthropic structured outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [AI SDK Anthropic provider 4.0.8 source](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/anthropic-language-model.ts)

One hidden cost bound deserves attention. Because the app omits `maxOutputTokens`, this provider version sends the model's maximum, 128,000 tokens, as `max_tokens`. Anthropic charges actual output, not the requested maximum, so this does not make every call expensive. It leaves an unnecessarily large worst case of $3.20 in output tokens for one provider response. The recipe schema and normal model stopping behavior should make that rare, but setting an explicit output limit is a sensible later cost guard. [AI SDK Anthropic provider 4.0.8 model capabilities and request construction](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/anthropic-language-model.ts), [Anthropic model limits](https://platform.claude.com/docs/en/about-claude/models/overview)

## Price categories

Anthropic's published direct-API prices for Claude Opus 4.8 are:

| Usage category | USD per million tokens | Relevant now? |
| --- | ---: | --- |
| Uncached input | $5.00 | Yes |
| 5-minute cache write | $6.25 | No, caching is not enabled |
| 1-hour cache write | $10.00 | No, caching is not enabled |
| Cache read or refresh | $0.50 | No, caching is not enabled |
| Output | $25.00 | Yes |

These are standard, global-routing prices. Fast mode doubles the Opus 4.8 input and output rates to $10 and $50 per million tokens. US-only inference adds a 1.1 multiplier. Batch processing halves standard input and output prices. None of those modifiers is present in the current call. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)

Prompt caching is opt-in. A request without a top-level or block-level `cache_control` pays the uncached input price. The app sends no cache control, even though the provider exposes one through `providerOptions`. [Anthropic prompt caching documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [AI SDK Anthropic provider options](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/anthropic-language-model-options.ts)

### Images

Images do not have a separate price. Anthropic turns each image into 28 by 28 pixel patches and bills those visual tokens at the model's input-token rate. Claude Opus 4.8 accepts up to 4,784 visual tokens per image and a 2,576-pixel long edge before server resizing. The response usage already includes those visual tokens, so a cost record should use returned usage rather than calculate image tokens from file bytes or dimensions. [Anthropic vision documentation](https://platform.claude.com/docs/en/build-with-claude/vision)

The pixel formula is useful before a request, if the product later needs a warning or hard preflight limit. It is not needed for retrospective cost reporting.

### Reasoning

Claude Opus 4.8 supports adaptive thinking, but thinking is off when the request omits the `thinking` field. That is what the current call does. [Anthropic Opus 4.8 migration guidance](https://platform.claude.com/docs/en/about-claude/models/migration-guide)

If thinking is enabled later, Anthropic bills reasoning as output tokens. `usage.output_tokens` is the inclusive billing total, and `usage.output_tokens_details.thinking_tokens` is only a diagnostic breakdown. Adding reasoning tokens on top of output tokens would double-count them. [Anthropic thinking documentation](https://platform.claude.com/docs/en/about-claude/models/extended-thinking-models), [Messages API usage fields](https://platform.claude.com/docs/en/api/typescript/messages)

The installed Anthropic provider maps total output correctly, but it leaves AI SDK's normalized `outputTokenDetails.reasoningTokens` undefined. Provider metadata uses a loose copy of Anthropic's raw usage object, so any future reasoning breakdown should come from raw Anthropic usage and should be verified when the provider is upgraded. This does not affect the cost total because `outputTokens` remains inclusive. [AI SDK Anthropic usage conversion](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/convert-anthropic-usage.ts)

## What to read from `generateText`

On a successful call, the relevant AI SDK result fields are:

| Field | Use |
| --- | --- |
| `usage.inputTokenDetails.noCacheTokens` | Multiply by the uncached input rate |
| `usage.inputTokenDetails.cacheReadTokens` | Multiply by the cache-read rate |
| `usage.inputTokenDetails.cacheWriteTokens` | Multiply by the applicable cache-write rate |
| `usage.outputTokens` | Multiply by the output rate, including any reasoning |
| `usage.raw` or `providerMetadata.anthropic.usage` | Preserve provider details not normalized by AI SDK |
| `response.modelId` | The model reported by Anthropic, used for the price lookup |
| `response.id` | Anthropic Message object ID |
| `response.headers["request-id"]` | Anthropic HTTP request ID for debugging |

AI SDK's normalized `inputTokens` is the total of uncached input, cache reads, and cache writes in this provider. Do not multiply that total by the base input rate and then add cache categories. That would double-count cached tokens. [AI SDK language-model usage type and aggregation](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/types/usage.ts), [AI SDK Anthropic usage conversion](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/convert-anthropic-usage.ts)

If 1-hour caching is introduced, the normalized `cacheWriteTokens` total is not enough to price a mix of 5-minute and 1-hour writes. Read Anthropic's raw `usage.cache_creation` breakdown, or record the configured cache TTL with the call. This distinction can wait because the current import does not cache.

## A small provider-neutral seam

AI SDK 7 gives every language-model provider the same optional usage slots: total input, uncached input, cache reads, cache writes, total output, text output, reasoning output, total tokens, and raw provider usage. A step also names its requested provider and model. Its response has an ID, model ID, timestamp, and optional HTTP headers. These are useful common fields, but they are not a common billing contract. Any token count may be missing, and `raw` exists precisely because providers report categories that AI SDK does not normalize. [AI SDK `generateText` reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [AI SDK 7.0.16 usage type](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/types/usage.ts), [AI SDK 7.0.16 step result](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/generate-text/step-result.ts)

The provider-neutral part of an import record can stay this small. The app's import ID, Household, User, source kind, outcome, and timestamps sit alongside it.

```text
provider, requestedModelId, responseModelId?
sdkCallId?, sdkResponseId?, externalRequestId?
inputTokens?, uncachedInputTokens?, cacheReadInputTokens?, cacheWriteInputTokens?
outputTokens?, textOutputTokens?, reasoningOutputTokens?, totalTokens?
rawUsage?
estimatedAmount?, currency?, estimateStatus, pricingAdapterVersion?
```

Every usage field stays nullable. Missing data must not become zero. `rawUsage` is the small provider usage object, not prompt or response content.

Two identifiers need careful labels. AI SDK uses a provider response ID when one exists, but generates one otherwise. It also uses the provider's response model when available and falls back to the requested model. Neither field carries a provenance flag. A provider adapter should therefore extract any true external request or response identifier separately. For Anthropic, those are the `request-id` HTTP header and the `msg_...` Message ID. [AI SDK `generateText` response semantics](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [Anthropic request IDs](https://platform.claude.com/docs/en/api/errors)

Pricing belongs in a narrow provider-and-model adapter. Its input is the provider, requested and response model IDs, normalized usage, raw usage, and known request modifiers. Its output is an amount, currency, pricing version, status, and a short cost breakdown. The adapter must own unit prices and provider rules such as cache-write TTLs, service tiers, data-residency or speed multipliers, image and reasoning treatment, and non-token fees. If it does not recognize a model or required usage category, it should return `unknown`, never zero.

Only an Anthropic adapter is needed now. A future provider adds another adapter without changing the import record or dashboard totals. This is enough flexibility without building a universal billing engine or a database of every provider's price book.

The current import has one model step. If it later becomes multi-step or mixes models, price `result.steps` individually and sum their cost lines. `totalUsage` alone cannot safely price tokens produced by different models or providers at different rates. [AI SDK multi-step result documentation](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)

## Model identity and pricing identity

`claude-opus-4-8` looks like an alias because it has no date. It is not an evergreen alias. Anthropic says every model ID from the Claude 4.6 generation onward is a pinned snapshot, including dateless IDs. [Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview)

The installed provider copies Anthropic's response `model` into AI SDK's `response.modelId`. Record both the requested model and response model. Use the response model for price selection, with the requested model as a fallback if a response omits it. This matters if model fallbacks or a provider gateway are introduced later. [AI SDK Anthropic provider response mapping](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/anthropic-language-model.ts)

A pinned model ID does not pin its commercial price forever. The cost estimate should therefore be fixed when the event is recorded. A small versioned price table in application code is enough. Store an exact decimal USD amount or integer microdollars so sub-cent imports do not round to zero. There is no need to preserve a full provider invoice model.

## Retries, failures, and cancellation

The current call silently inherits AI SDK's default of two retries, which means up to three HTTP attempts for one logical import. AI SDK retries network errors and API errors marked retryable. In the installed packages, 408, 409, 429, and status codes 500 or higher are retryable. It waits with exponential backoff and respects reasonable `retry-after` headers. Abort errors are not retried. [AI SDK 7.0.16 retry preparation](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/util/prepare-retries.ts), [AI SDK 7.0.16 retry policy](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/util/retry-with-exponential-backoff.ts), [AI SDK provider retry implementation](https://github.com/vercel/ai/blob/%40ai-sdk/provider-utils%405.0.5/packages/provider-utils/src/retry-with-exponential-backoff.ts)

The successful `generateText` result does not add usage from earlier failed retry attempts. The retry wrapper returns only the eventual successful provider result, then `generateText` aggregates successful model steps. This import has one model step, so its final usage is the successful attempt's usage only. [AI SDK 7.0.16 `generateText` source](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/generate-text/generate-text.ts)

Anthropic's normal error body contains an error type, message, and request ID, not token usage. AI SDK likewise rejects on provider errors or aborts without returning a `GenerateTextResult`. A cancelled request therefore has no local usage figure. A retry error can retain the individual API errors and their response headers, but not normalized token usage. [Anthropic error format](https://platform.claude.com/docs/en/api/errors), [AI SDK provider API error type](https://github.com/vercel/ai/blob/%40ai-sdk/provider%404.0.2/packages/provider/src/errors/api-call-error.ts)

There is a smaller application-level wrinkle. A provider response can consume tokens and then fail to become a usable import. Examples include structured-output parsing failure and the app deciding that `isRecipe` is false. Usage should be recorded as soon as a provider response is available, before the product outcome is applied. AI SDK's `onStepEnd` callback runs after it has normalized the provider response and before it parses the final `Output.object`, so it is the available capture point for schema-parsing failures. [AI SDK 7.0.16 `generateText` source](https://github.com/vercel/ai/blob/ai%407.0.16/packages/ai/src/generate-text/generate-text.ts)

One fact remains undocumented: whether Anthropic can bill any work behind a failed, timed-out, disconnected, or cancelled request that returned no usage. A network can fail after the provider accepted work, so it would be unsafe to claim that all such attempts cost zero. Record those attempts with `costStatus = unknown` rather than inventing a zero. At this project's scale, the occasional gap is acceptable.

## Anthropic Usage and Cost Admin API

Anthropic has two organization-level reporting endpoints:

- The Usage API returns token consumption in 1-minute, 1-hour, or 1-day buckets. It can filter and group by API key, workspace, model, service tier, context-window band, inference geography, and speed. It separates uncached input, cache creation, cache reads, output, and server-tool use. A page can contain at most 1,440 minute buckets, 168 hour buckets, or 31 day buckets; longer reports use pagination.
- The Cost API returns USD cost in daily buckets. It can group by workspace and billing description. Costs are decimal strings in cents.

Reports normally appear within five minutes, though delays can be longer. The Admin API needs a separate Admin API key and is unavailable to individual accounts. [Anthropic Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)

These endpoints cannot group by Plan Eat Repeat User, Household, import source, product outcome, or import attempt. Anthropic's `metadata.user_id` request field is an opaque user identifier intended in part for abuse detection, and the installed provider can send it. It is not listed as a Usage or Cost API dimension. There is only one such field, so it cannot represent both User and Household anyway. [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create), [AI SDK Anthropic provider options](https://github.com/vercel/ai/blob/%40ai-sdk/anthropic%404.0.8/packages/anthropic/src/anthropic-language-model-options.ts), [Anthropic Usage and Cost API dimensions](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)

The Admin API is therefore optional for this hobby project. Local event records answer the per-Household and per-User question with less machinery and no second secret. The Claude Console already provides organization totals for an occasional sanity check. An Admin API integration becomes worthwhile only if estimate drift matters, failed or retried calls form a noticeable share of spend, or automated spend alerts are needed.

The Admin API does not offer per-request reconciliation. Its reports are aggregated buckets and do not expose Anthropic request IDs. The `request-id` header is still worth storing on successful responses and extracting from API errors because Anthropic asks for it in support cases. The `anthropic-workspace-id` response header can connect a call to the Admin API's workspace dimension, but one global API key means it does not provide Household attribution. [Anthropic request IDs](https://platform.claude.com/docs/en/api/errors), [Anthropic workspace response headers](https://platform.claude.com/docs/en/manage-claude/workspaces)

The current Usage and Cost API documentation calls the data historical but does not publish a retention period for these metrics. That is another reason not to use it as Plan Eat Repeat's only long-term record.

## Minimal design implications

For the first version, one local record per logical AI import is enough. It should retain:

- Household ID as the accountable unit and User ID as the actor
- source kind and product outcome
- AI SDK provider, requested model, and response model
- uncached input, cache-read, cache-write, and output token counts
- raw provider usage metadata
- estimated cost fixed at call time, currency, and a small pricing-adapter version
- provider response and HTTP request IDs when available
- start and finish timestamps
- cost status such as `estimated`, `zero-before-provider`, or `unknown`

Do not store prompts or responses for cost reporting. They do not improve the calculation. Product-quality evaluation can make a separate retention decision later.

Keep the first dashboard descriptive. Sum estimated cost by day, Household, User, source kind, outcome, and model. Also show imports with unknown cost so the estimate's blind spot stays visible.

The cost event should survive a failed product outcome. An import that returns `isRecipe: false`, produces invalid structured output, or is abandoned after generation still used provider capacity.

Anomaly detection later can use the same data. A simple daily or rolling-seven-day total and a comparison with the preceding period is enough to start. There is no need to adopt the Admin API, an observability vendor, budgets, or quotas before usage justifies them.

## Facts still worth validating during implementation

1. Inspect one real text import and one real four-photo import in development. Confirm which exact usage fields AI SDK 7.0.16 populates and save anonymized sample shapes in a test fixture.
2. Force a valid Anthropic response that fails local schema validation. Confirm `onStepEnd` exposes usage and headers before `generateText` rejects.
3. Force a retryable error with a mock provider. Confirm which request IDs remain reachable through `RetryError.errors` and ensure an import produces one logical record rather than one row per SDK attempt.
4. Decide an explicit `maxOutputTokens` from observed recipe outputs. The current 128,000-token ceiling is much larger than this feature needs.
5. Check whether the Anthropic account is an organization or an individual account before planning any Admin API work. Individual accounts cannot use it.

No research is needed before deciding the MVP's ownership and dashboard dimensions. Household, User, time, source kind, model, outcome, token categories, and estimated USD cost all come from data already available inside the request path. The unresolved provider-side cost of error and cancellation cases should be documented as estimate uncertainty, not allowed to block the first version.
