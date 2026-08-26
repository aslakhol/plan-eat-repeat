# Supadata YouTube migration plan

Checked 2026-08-26. This plan replaces the production YouTube transcript chain with Supadata. It does not add Supadata as another fallback. After this change, Supadata is the only source used by a YouTube recipe import.

## Decisions

- Keep `importRecipeFromUrl(url, instructions, signal)` and the two-argument `acquireYouTubeRecipeText(videoId, signal)` interface stable. The recipe extraction module will continue to receive one labeled evidence string and will not know which provider supplied it.
- Add a small server-only Supadata adapter. It will own authentication, request construction, status handling, job polling, runtime validation, billing headers, and provider diagnostics.
- Use direct `fetch` calls, not `@supadata/js`. The SDK has no `AbortSignal` or fetch injection, discards `x-billable-requests`, does not validate responses at runtime, treats billed HTTP 206 as a successful Fetch response, and has a job-result type that conflicts with the current OpenAPI contract. [Official SDK client](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/client.ts#L15-L95), [official SDK types](https://github.com/supadata-ai/js/blob/fe330d7aec34694c547b4744ca04ddb92ee3e828/src/types.ts#L44-L73)
- Use the current universal endpoints, `GET /v1/transcript` and `GET /v1/metadata`. Do not use the handoff's `/v1/youtube/video` reference because Supadata now marks it deprecated. [Transcript guide](https://docs.supadata.ai/get-transcript), [metadata guide](https://docs.supadata.ai/get-metadata), [deprecated endpoint](https://docs.supadata.ai/api-reference/endpoint/youtube/video-get)
- Always send `mode=native` and `text=true`. Never rely on Supadata's default `auto` mode. `native` costs one credit even when no caption is available; `auto` may start AI transcription at two credits per video minute. [Transcript modes and pricing](https://docs.supadata.ai/get-transcript#pricing)
- Request the transcript first, then metadata. Start Supadata requests at least one second apart so the importer works on the free plan's one-request-per-second limit. A normal captioned import costs two credits and stays within one acquisition deadline. A 206 caption miss still proceeds with Supadata metadata because a video description may contain the full written recipe. [Current plan limits](https://supadata.ai/pricing)
- Leave `dinner.youtubeVideoTitle` on YouTube oEmbed. It is a five-second, best-effort editor preview, costs no Supadata credit, and is not used by `importFromUrl`. The actual import must fetch its own Supadata metadata and must succeed or fail independently of the preview.
- Keep ordinary recipe-page acquisition unchanged. Issue #198 remains separate.

## Target module shape

The external seam remains in `apps/web/src/server/recipes/youtube.ts`:

```ts
acquireYouTubeRecipeText(
  videoId: string,
  requestSignal?: AbortSignal,
): Promise<string>
```

`youtube.ts` will keep the oEmbed title helper, own the 20-second acquisition deadline, format the provider-neutral evidence string, enforce its 40,000-character budget, and map unexpected acquisition failures to `ImportRecipeError`.

Add `apps/web/src/server/recipes/supadata.ts` as the concrete adapter. Give it one meaningful operation:

```ts
acquire(videoId: string, signal: AbortSignal): Promise<{
  title: string;
  description: string;
  transcript: string;
  transcriptLanguage: string | null;
}>
```

Build the adapter with injected `apiKey` and `fetch` dependencies. Production wiring supplies `env.SUPADATA_API_KEY` and the runtime fetch implementation. Tests supply an in-memory fetch adapter. Do not add a generic provider registry or fallback chain. Supadata is the sole production adapter.

If keeping the production export easy to test requires a factory, expose `createYouTubeRecipeTextAcquirer(adapter)` for tests and define the existing `acquireYouTubeRecipeText` export from the production adapter. Callers still receive the same two-argument function.

## Provider requests and validation

1. Convert the validated video ID to `https://www.youtube.com/watch?v=<id>` inside the adapter.
2. Request `GET https://api.supadata.ai/v1/transcript` with encoded `url`, `mode=native`, and `text=true` query parameters.
3. Request `GET https://api.supadata.ai/v1/metadata` with the same encoded `url`.
4. Send `x-api-key` on both requests. Do not put the key in a query parameter, client bundle, log field, error message, or response.
5. Run the calls under one 20-second `AbortSignal`. Request the transcript first and finish any transcript-job polling before requesting metadata. Start every Supadata request, including job polls, at least one second after the previous request started. Compose the deadline with the caller's signal. If the caller cancels, propagate cancellation. If the local deadline expires, return the normal acquisition failure. Supadata has no cancellation endpoint and warns that a timed-out call may still consume credits. [Latency contract](https://docs.supadata.ai/get-transcript#latency), [current plan limits](https://supadata.ai/pricing)
6. Do not retry metered requests automatically. Supadata does not document idempotency or retry billing. Polling a returned job is not a retry.
7. If the transcript call returns 202, poll `GET /v1/transcript/{jobId}` once per second within the same 20-second deadline. Accept `queued` and `active`, normalize the current OpenAPI top-level completed result and the official SDK's nested `result` shape, and fail on `failed`, malformed data, or deadline expiry. Do not add persistent jobs for this native-only release. Polling is free. [Job flow](https://docs.supadata.ai/get-transcript#getting-job-results)
8. Validate unknown JSON with Zod before reading it. A transcript success requires string `content`, non-empty string `lang`, and an array of non-empty provider language strings. Do not enforce a two-letter language regex because Supadata publishes values such as `zh-TW`.
9. Omit `lang` from the request. The application has no source-language preference at acquisition time, and hard-coding English would hurt Norwegian imports. Supadata will choose its first available language. Record the returned `lang` as the actual language and do not assume ordering in `availableLangs`. [Language behavior](https://docs.supadata.ai/get-transcript#languages)
10. Validate metadata as YouTube video data with the expected video ID, `platform === "youtube"`, and `type === "video"`. Normalize nullable or absent `title` and `description` to empty strings. Do not depend on unstable `additionalData`. [Metadata schema](https://docs.supadata.ai/get-metadata#base-schema)
11. Cap each JSON response body at 1 MiB before parsing. Reject an oversized `Content-Length` up front and stop a streamed body once it crosses the cap. Supadata documents no response-size limit.

The adapter should retain only normalized evidence plus safe operational fields such as HTTP status, endpoint name, provider error code, job state, and `x-billable-requests` when Supadata sends it. It must not retain or log response bodies, transcript text, descriptions, request headers, or the API key.

## Evidence policy

Keep the existing labels so the extraction prompt does not need to change:

```text
YouTube title:
...

YouTube description:
...

Caption transcript:
...
```

Make `youtube.ts` return no more than 40,000 characters, matching the current model-input cap. Cap the title at 500 characters and the description at 8,000 characters, including a `[truncated]` marker when needed. Give the transcript the remaining budget after labels and actual metadata lengths. This preserves written quantities near the front while preventing a long transcript from growing the prompt without limit. The later `trimForModel` call becomes a safety net rather than the mechanism that can cut off an entire section.

Treat an HTTP 206 `transcript-unavailable` response and a valid 200 response with empty content as an empty transcript, not as permission to generate one. Continue with Supadata metadata. If both the normalized description and transcript are empty, throw `NO_RECIPE_FOUND` before calling the recipe model. If the description is non-empty, let the existing extractor decide whether it contains a Recipe. The product tradeoff is explicit: captionless videos still work when their description contains a written recipe, but audio-only recipes do not import in this release.

Supadata does not promise whether `native` distinguishes creator captions from YouTube automatic captions. For this release, "native" means an existing transcript returned without Supadata AI generation. [Native-caption contract](https://docs.supadata.ai/errors/transcript-unavailable)

## Failure mapping and user copy

Add one provider-neutral `IMPORT_LIMIT_REACHED` code to the shared import contract. Keep every other tRPC and client error unchanged.

| Condition | `ImportRecipeError` result | User behavior |
| --- | --- | --- |
| Caller cancels | Propagate the cancellation | The abandoned request does not show an import error. |
| Missing local key | `FETCH_FAILED` | Video importing is temporarily unavailable; server diagnostics say `configuration` without logging a key. |
| 400 invalid request | `FETCH_FAILED` | Treat as an adapter or upstream contract failure and log the sanitized provider code. |
| 401 invalid or expired key | `FETCH_FAILED` | Treat as an operational configuration failure. |
| 402 plan restriction | `FETCH_FAILED` | Treat as an operational plan failure. |
| 403 restricted video or 404 missing/private video | `FETCH_FAILED` | Tell the user that the video may be unavailable. Preserve status only in diagnostics. |
| 429 rate or credit limit | `IMPORT_LIMIT_REACHED` | Ask the user to tell Aslak that the Supadata plan needs upgrading. Diagnostics retain `limit-exceeded`; the provider response cannot distinguish quota from rate limit. |
| 5xx, network error, timeout, failed job, invalid JSON/schema, or oversized body | `FETCH_FAILED` | Treat as temporary provider acquisition failure. |
| 206 or empty transcript, with no description | `NO_RECIPE_FOUND` | Use the existing video-specific no-recipe guidance. |
| 206 or empty transcript, with a description | Continue to extraction | A written recipe may still import. If it is not a Recipe, extraction returns `NO_RECIPE_FOUND`. |
| Valid evidence but model call fails | `EXTRACTION_FAILED` | Keep current behavior. |

`SITE_BLOCKED` and `PAGE_UNREADABLE` remain page-import outcomes and are not emitted by the Supadata path.

Update the web's video-specific `FETCH_FAILED` copy in `apps/web/src/lib/url-import.ts`. It currently says "YouTube didn't answer," which is no longer accurate. Use provider-neutral wording such as:

> Couldn't reach the video
>
> The video may be unavailable, or video importing may be temporarily unavailable. Try again later.

Use this shared web and mobile copy for `IMPORT_LIMIT_REACHED`: "We've hit the video import limit. Please let Aslak know that we need to upgrade the Supadata plan."

Keep `YOUTUBE_NO_RECIPE_FOUND_MESSAGE`, which accurately covers the captionless and no-written-recipe case.

## File changes

1. Add `apps/web/src/server/recipes/supadata.ts` with the direct HTTP adapter, Zod schemas, bounded JSON reader, job polling, error normalization, and sanitized diagnostics.
2. Rewrite the acquisition implementation in `apps/web/src/server/recipes/youtube.ts` to use the Supadata adapter. Keep `acquireYouTubeRecipeText` and `acquireYouTubeVideoTitle`; remove all watch-page, player, caption-track, automatic-track, InnerTube, recaptcha, visitor-data, and proof-token logic.
3. Delete `apps/web/src/server/recipes/youtube-po-token.ts` and `apps/web/src/server/recipes/youtube-po-token.test.ts`.
4. Replace the old `youtube.test.ts` production-failure fixtures with provider-independent evidence-formatting tests and an in-memory adapter. Keep the three known production video IDs in success fixtures so those regressions remain represented without network calls.
5. Add `apps/web/src/server/recipes/supadata.test.ts` for the provider contract and failure matrix.
6. Add optional server-only `SUPADATA_API_KEY` validation to `apps/web/src/env.ts`. Keeping it optional lets the rest of the application and non-import tests start without the integration; the adapter must turn a missing value into the controlled `FETCH_FAILED` path.
7. Add only `SUPADATA_API_KEY=` to `apps/web/.env.example`, with a comment that the real value belongs in `apps/web/.env` locally and the deployment secret store in production. Do not add a value to either tracked env example.
8. Remove `youtube-transcript-plus`, `bgutils-js`, `jsdom`, and `@types/jsdom` from `apps/web/package.json`, then refresh `pnpm-lock.yaml`. Current repository usage shows these packages belong only to the legacy YouTube chain.
9. Update `apps/web/src/lib/url-import.ts` and `url-import.test.ts` for provider-neutral video acquisition copy.
10. Leave `apps/web/src/server/recipes/importRecipe.ts`, the `dinner.importFromUrl` router contract, the extraction prompt, ordinary page imports, and `dinner.youtubeVideoTitle` behavior unchanged except for any import wiring needed by the rewritten `youtube.ts`.

## Unit tests

All tests use injected in-memory fetch or source adapters. None calls Supadata or YouTube.

- A successful 200 transcript and metadata pair asserts the exact endpoints, encoded URL, `x-api-key`, `mode=native`, `text=true`, absence of `lang`, normalized title/description/transcript, and captured billable-request headers.
- Request-order tests prove that metadata does not start before the transcript finishes and that Supadata request starts remain at least one second apart under the production defaults.
- A 202 transcript test covers queued, active, and completed polling. Cover both officially published completed-result shapes. Separate tests cover `failed` and deadline expiry.
- A language test accepts `zh-TW`, uses the returned language, and does not infer the requested language.
- Metadata tests accept nullable title and description, reject a non-YouTube platform, reject a non-video type, and reject a mismatched video ID.
- A native-caption 206 test proves that no generate request or retry occurs and that metadata-only evidence can continue.
- An empty 200 transcript test has the same no-generation guarantee.
- Table-driven failures cover missing key, 400, 401, 402, 403, 404, 429, 500, transport failure, malformed JSON, schema mismatch, and a body over 1 MiB. Assert `IMPORT_LIMIT_REACHED` for 429 and `FETCH_FAILED` for the other provider failures, plus sanitized diagnostics that never include provider bodies or credentials.
- Cancellation tests distinguish caller abort from the adapter's 20-second timeout and confirm polling stops.
- Evidence-formatting tests assert the existing labels, the 40,000-character maximum, metadata preservation, transcript use of remaining space, and truncation markers.
- A no-transcript and no-description test asserts `NO_RECIPE_FOUND` without invoking extraction. A non-empty description test asserts that acquisition succeeds even when captions are unavailable.
- oEmbed preview tests retain its current best-effort null behavior and prove it is independent of the Supadata adapter.
- Client-copy tests assert the revised video `FETCH_FAILED` text, the `IMPORT_LIMIT_REACHED` upgrade request, and unchanged page-import copy.

## Secret, deployment, and production verification

1. Choose a Supadata plan with enough headroom for two credits per normal captioned import. A 206 caption miss consumes its one transcript credit; Supadata does not document billing for every other failure. Keep automatic AI transcript generation disabled by code through explicit `mode=native`; dashboard auto-recharge is a separate billing choice and should not be enabled implicitly.
2. Before deploying the code, add `SUPADATA_API_KEY` to the Vercel project's Production environment as a secret. Use a separate key for Preview only if preview smoke tests are required. Do not copy credentials into source, issue comments, pull-request text, documentation, or logs.
3. Deploy or redeploy after setting the secret so the new deployment receives it. A deployment without the key must keep the application healthy while YouTube imports return the controlled provider-unavailable error.
4. Run production smoke imports for `BoFkDmTm2uc`, `YdFjuglEAds`, and `nHDNtxvrhHc`. Confirm that each produces a structured Import Draft from Supadata-supplied title, description, and caption evidence. Code inspection and unit tests must prove that import acquisition makes no request to YouTube watch, player, caption, BotGuard, or integrity-token endpoints. The independent oEmbed title preview may still call YouTube.
5. Check Supadata's dashboard and sanitized server diagnostics. Confirm two credits per normal import, no per-minute generation charges, `x-billable-requests` where supplied, and useful 206, 429, and 5xx categories.
6. Test one public captionless video with a written recipe in its description and one with no written recipe. Confirm description-only extraction for the first and `NO_RECIPE_FOUND` for the second. Do not enable `auto` to make the second pass.

## Verification commands

Run from the repository root:

```bash
pnpm exec tsx --test \
  apps/web/src/server/recipes/supadata.test.ts \
  apps/web/src/server/recipes/youtube.test.ts \
  apps/web/src/lib/url-import.test.ts
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm lint` and `pnpm typecheck` are mandatory before opening the pull request under `AGENTS.md`. The targeted tests and build are also required for this migration because it changes network acquisition, environment validation, and server dependencies.

## Acceptance criteria

- A YouTube recipe import makes sequential Supadata native-transcript and metadata requests at no more than one request per second and uses no legacy YouTube acquisition code.
- The public import and tRPC interfaces remain unchanged.
- No execution path can request Supadata-generated transcripts.
- Captionless videos use a Supadata description when it contains a Recipe and otherwise return the existing no-recipe outcome.
- The caller's cancellation and the 20-second acquisition deadline stop local work, including job polling.
- Evidence never exceeds 40,000 characters, and raw provider responses never exceed the 1 MiB read cap.
- Supadata credentials exist only in server-side environment configuration.
- Missing credentials, exhausted credits, unavailable videos, provider outages, and malformed responses all produce deliberate, tested outcomes.
- The old watch-page, player, caption URL, proof-token modules, diagnostics, tests, and dependencies are gone.
- The three production regression video IDs pass the production smoke test through Supadata.
