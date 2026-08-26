# Supadata contracts for the YouTube migration

Checked 2026-08-26 against Supadata's live documentation, published OpenAPI schema, pricing page, and official JavaScript SDK source. This note covers the first release described in the migration handoff: existing captions only, with no AI-generated transcript fallback.

## Recommended API contract

Use the universal endpoints through direct server-side HTTP requests:

- `GET https://api.supadata.ai/v1/transcript?url=...&text=true&mode=native`
- `GET https://api.supadata.ai/v1/metadata?url=...`
- `x-api-key: ...` on both requests

The handoff links to `GET /v1/youtube/video`, but Supadata now marks that endpoint deprecated. The official SDK marks its matching `youtube.video()` method deprecated and directs callers to `metadata()` instead. The universal metadata endpoint is the current contract for title and description. [Deprecated YouTube video reference](https://docs.supadata.ai/api-reference/endpoint/youtube/video-get), [current metadata guide](https://docs.supadata.ai/get-metadata), [official SDK YouTube service](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/services/youtube.ts#L98-L112)

All API calls use the `https://api.supadata.ai/v1` base URL and require an `x-api-key` header. Supadata tells customers to keep the key in environment configuration and call the API only from a secure server environment. A missing, invalid, or expired key produces HTTP 401 with error code `unauthorized`. [API introduction](https://docs.supadata.ai/api-reference/introduction), [getting started](https://docs.supadata.ai/), [unauthorized error](https://docs.supadata.ai/errors/unauthorized)

## Transcript request and response

`GET /v1/transcript` requires a supported video URL. Its relevant query parameters are:

| Parameter | Contract for this migration |
| --- | --- |
| `url` | Required YouTube URL. Encode it as a query parameter. |
| `mode` | Send `native` explicitly. The default is `auto`, which can start paid AI generation when an existing transcript is unavailable. |
| `text` | Send `true` to receive one transcript string. The default is timed chunks. |
| `lang` | Optional preferred language. See the language caveats below. |
| `chunkSize` | Only applies when `text=false`; allowed range is 50 through 10,000 characters per chunk. It does not cap the whole transcript. |

These parameters and defaults come from the [transcript guide](https://docs.supadata.ai/get-transcript) and [OpenAPI schema](https://docs.supadata.ai/api-reference/v1-openapi.json).

With `text=true`, HTTP 200 returns:

```json
{
  "content": "transcript text",
  "lang": "en",
  "availableLangs": ["en", "es"]
}
```

Without `text=true`, `content` is an array of `{ text, offset, duration, lang }` chunks, with times in milliseconds. All three top-level fields are required by the OpenAPI transcript schema. [Transcript response contract](https://docs.supadata.ai/get-transcript#response-format), [OpenAPI schema](https://docs.supadata.ai/api-reference/v1-openapi.json)

The endpoint-level contract also permits HTTP 202 with `{ "jobId": "..." }`. Job status is fetched from `GET /v1/transcript/{jobId}` and can be `queued`, `active`, `completed`, or `failed`. Supadata recommends polling once per second, does not charge for polling, and deletes completed job results after one hour. The docs tie asynchronous processing mainly to AI generation and videos over 20 minutes, but do not explicitly promise that `mode=native` can never return 202. A native-only adapter should therefore validate and handle the 202 shape even if the product chooses to reject it as an unexpected provider response rather than introduce background jobs. [Transcript job flow](https://docs.supadata.ai/get-transcript#getting-job-results), [job-result reference](https://docs.supadata.ai/api-reference/endpoint/transcript/transcript-get)

There is an official contract mismatch for completed jobs. The guide's example and OpenAPI schema put `content`, `lang`, and `availableLangs` at the top level, while nearby prose and the official SDK's `JobResult<T>` type refer to a `result` field. This does not affect the expected synchronous native-caption path, but any later job support needs a live contract test before release. [Transcript guide](https://docs.supadata.ai/get-transcript#getting-job-results), [OpenAPI schema](https://docs.supadata.ai/api-reference/v1-openapi.json), [official SDK types](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/types.ts#L157-L168)

## Native captions and language semantics

`mode=native` fetches only an existing platform transcript. It does not invoke Supadata's AI transcription. A video with no available captions returns HTTP 206 with `transcript-unavailable`; that miss still costs one credit. The default `auto` mode must not be used for this release because it falls back to generation at two credits per video minute. [Transcript modes and pricing](https://docs.supadata.ai/get-transcript#pricing), [transcript-unavailable error](https://docs.supadata.ai/errors/transcript-unavailable)

Supadata does not document whether `native` distinguishes creator-uploaded captions from YouTube's automatic captions. The response has no caption-source field, and the current universal metadata schema does not promise transcript-track metadata. Treat `native` as "an existing transcript Supadata can return," not as a guarantee of a manual caption track. [Transcript schema](https://docs.supadata.ai/api-reference/endpoint/transcript/transcript), [metadata schema](https://docs.supadata.ai/get-metadata#response-format)

Language selection is permissive:

- If `lang` is absent, Supadata returns the first available language.
- If the requested language is unavailable, Supadata silently returns the first available language and reports the actual selection in `lang`.
- `availableLangs` lists the alternatives known for that response.
- In generated mode, Supadata ignores `lang` and transcribes in the spoken language.

The adapter must trust the returned `lang`, not the requested value. Supadata describes these as ISO 639-1 codes but also publishes `zh-TW` in examples, so runtime validation should accept non-empty provider language strings rather than require exactly two letters. [Language behavior](https://docs.supadata.ai/get-transcript#languages), [transcript reference](https://docs.supadata.ai/api-reference/endpoint/transcript/transcript)

## Metadata request and response

`GET /v1/metadata` accepts one required, encoded `url` query parameter. For YouTube, the response can contain `platform`, `type`, `id`, canonical URL, title, description, author, engagement statistics, media details, tags, creation time, and `additionalData`. [Metadata guide](https://docs.supadata.ai/get-metadata)

The published OpenAPI schema only requires `platform`, `type`, and `id`. It allows `title` and `description` to be null, and it does not require the other evidence fields. `additionalData` is platform-specific and explicitly subject to change. The adapter should validate `platform === "youtube"` and `type === "video"`, validate the fields it consumes, and normalize an absent or null description without depending on `additionalData`. [Metadata response and stability notes](https://docs.supadata.ai/get-metadata#base-schema), [OpenAPI schema](https://docs.supadata.ai/api-reference/v1-openapi.json)

The deprecated `GET /v1/youtube/video` response was stricter. It required `id`, `title`, `description`, duration, channel, tags, and `transcriptLanguages`. Those guarantees do not carry over to the universal metadata schema. [Deprecated YouTube video reference](https://docs.supadata.ai/api-reference/endpoint/youtube/video-get)

## HTTP failures

Supadata publishes a standard JSON error body with `error`, `message`, `details`, and an optional `documentationUrl`. The global error catalog is broader than the status lists on individual endpoint pages, so an adapter should handle the global set rather than only the statuses shown under one endpoint. [Error catalog](https://docs.supadata.ai/errors/list), [OpenAPI schema](https://docs.supadata.ai/api-reference/v1-openapi.json)

| HTTP status and code | Documented meaning for this integration |
| --- | --- |
| 206 `transcript-unavailable` | No existing caption or subtitle is available. The call still costs one credit. |
| 400 `invalid-request` | A required parameter is missing, malformed, or violates a constraint. |
| 401 `unauthorized` | API key is missing, invalid, or expired. |
| 402 `upgrade-required` | The endpoint or feature is unavailable on the current plan. This is not the documented exhausted-credit response. |
| 403 `forbidden` | Supadata cannot access restricted media, including login, membership, age, or geographic restrictions. |
| 404 `not-found` | The video is missing, deleted, or private. An expired transcript job also returns 404. |
| 429 `limit-exceeded` | Either the short-term request rate or the plan's monthly credit quota was exceeded. The documented response does not distinguish those cases with separate codes. |
| 500 `internal-error` | Supadata or one of its dependencies failed. Supadata recommends retrying after a short delay. |

Sources: [transcript unavailable](https://docs.supadata.ai/errors/transcript-unavailable), [invalid request](https://docs.supadata.ai/errors/invalid-request), [unauthorized](https://docs.supadata.ai/errors/unauthorized), [upgrade required](https://docs.supadata.ai/errors/upgrade-required), [forbidden](https://docs.supadata.ai/errors/forbidden), [not found](https://docs.supadata.ai/errors/not-found), [limit exceeded](https://docs.supadata.ai/errors/limit-exceeded), [internal error](https://docs.supadata.ai/errors/internal-error).

Because the 429 response covers both request-rate and credit-quota failures, the application cannot name which limit was reached. It should return one `IMPORT_LIMIT_REACHED` outcome that asks the user to tell Aslak the Supadata plan needs upgrading.

Supadata's accessibility guide overlaps 403 and 404. It specifically says private or nonexistent video can be 404, while authentication or access restrictions can be 403. Both statuses can therefore describe a video that the importer cannot use; diagnostics may retain the distinction even if the product maps them to the same user-facing outcome. Only complete media is supported, so an ongoing live stream is unavailable. [Video accessibility and live streams](https://docs.supadata.ai/get-transcript#video-accessibility)

Transport failure, client cancellation, invalid JSON, an oversized response, and a response that fails local schema validation are not separate Supadata error codes. The adapter needs its own provider-failure categories for those cases.

## Timeouts, cancellation, retries, and size limits

Supadata gives no numeric latency target or server timeout for native transcripts or metadata. Its only numeric guidance concerns AI generation, which can remain synchronous for up to two minutes and becomes asynchronous for videos over 20 minutes. The docs warn that a client timeout can still consume credits. [Transcript latency](https://docs.supadata.ai/get-transcript#latency)

No cancellation endpoint, abort semantics, idempotency key, retry count, backoff schedule, or `Retry-After` contract is documented for these endpoints. Aborting a local `fetch` can stop this application from waiting, but the published contract does not say it stops Supadata's work or prevents billing. Because both acquisition requests are metered, automatic retries may consume another credit. This billing behavior for retries is not documented and should be confirmed in a trial.

Supadata publishes no maximum YouTube duration, transcript character count, metadata-description length, or response-body size. `chunkSize` only limits individual chunks when `text=false`; it is not an overall evidence limit and does not apply to `text=true`. The adapter therefore needs a local response-byte guard and a local evidence-size policy before it passes title, description, and transcript to recipe extraction. [Transcript parameters](https://docs.supadata.ai/get-transcript#query-parameters)

The guide does define limits for public file URLs, currently 750 MB and 12 hours, but those are not stated as YouTube limits and should not be generalized to YouTube imports. [File transcript limits](https://docs.supadata.ai/get-transcript#file-transcripts)

## Credits and rate limits

A native-caption import costs two credits when both calls are made: one for the transcript and one for metadata. A native-caption miss costs one transcript credit even though it returns 206. AI generation costs two credits per video minute. Transcript-job polling is free. The transcript guide says responses include `x-billable-requests`, which can be logged to reconcile observed charges with the dashboard. [Transcript pricing and billing header](https://docs.supadata.ai/get-transcript#pricing), [metadata pricing](https://docs.supadata.ai/get-metadata#pricing), [pricing page](https://supadata.ai/pricing)

Current published plans and request rates are:

| Plan | Monthly credits | Price | Rate limit |
| --- | ---: | ---: | ---: |
| Free | 100 | $0 | 1/second |
| Basic | 300 | $5 | 10/second |
| Pro | 3,000 | $17 | 10/second |
| Mega | 30,000 | $47 | 50/second |
| Giga | 300,000 | $297 | 100/second |
| Supa | 1,000,000 | $897 | 100/second |

Basic is annual-only. Prices exclude tax, credits do not roll over, and paid plans can enable automatic recharge. Without more credits or automatic recharge, calls stop at the plan limit and return the documented 429 quota error. [Current pricing and quota behavior](https://supadata.ai/pricing), [limit-exceeded error](https://docs.supadata.ai/errors/limit-exceeded)

The adapter must support the free plan. It should serialize transcript, transcript-job, and metadata calls and keep request starts at least one second apart. Awaiting each response without spacing is insufficient because two fast responses could still start within the same one-second rate-limit window.

The docs do not state whether failed metadata calls or transcript failures other than the explicitly billed 206 consume credits. They also do not state how partial generated minutes are rounded. Neither uncertainty changes the native-only mode choice, but a production trial should verify actual charges for representative failures.

## SDK versus direct HTTP

Direct HTTP is the better fit for this adapter. Supadata's current official JavaScript SDK is a small wrapper, but it omits controls and observability this migration needs:

- `SupadataConfig` accepts only `apiKey` and optional `baseUrl`; there is no timeout, `AbortSignal`, or injected `fetch` option.
- The client returns parsed JSON only, so callers cannot inspect HTTP status or `x-billable-requests`.
- It casts JSON to TypeScript types without runtime validation.
- It throws `SupadataError` only when `response.ok` is false. Because HTTP 206 is a successful 2xx response under Fetch semantics, the documented `transcript-unavailable` body can pass through as if it were the requested transcript type.
- Its completed-job type uses `result?: T`, which conflicts with the current guide example and OpenAPI schema.

These observations come directly from the [official SDK client](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/client.ts#L15-L95), [configuration and response types](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/types.ts#L44-L73), and [transcript service](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/services/transcript.ts#L10-L44). A direct `fetch` adapter can set a deadline with `AbortSignal`, branch on every HTTP status, retain billing headers, and validate unknown JSON at the provider boundary without adding a dependency.

## Unknowns to resolve in a production trial

The official contract is silent or inconsistent on these points:

- whether `mode=native` can return HTTP 202 in practice;
- whether an existing YouTube automatic caption is always eligible for `mode=native`;
- how to distinguish manual captions from YouTube automatic captions;
- which language counts as "first available" and whether its ordering is stable;
- the exact completed-job response shape;
- native-transcript and metadata latency distributions;
- provider-side behavior after client cancellation;
- response-size and hosted-video duration limits;
- retry billing and whether successful responses expose a documented retry hint;
- billing for metadata errors and transcript errors other than 206.

None of these gaps justify enabling `mode=auto`. The initial implementation can avoid the costliest uncertainty by always sending `mode=native`, rejecting malformed or oversized evidence locally, and treating provider-specific behavior as private adapter detail.
