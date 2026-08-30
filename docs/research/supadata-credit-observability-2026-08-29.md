# Supadata per-request credit observability

Checked 2026-08-29 against Supadata's live documentation, API reference, pricing page, and official JavaScript SDK source.

## Answer

Yes. Supadata documents an `x-billable-requests` response header and says its value is "the number of credits consumed by that request." Despite the header's name, Supadata defines the value as credits, not as a count of HTTP requests. The documented JSON response bodies do not contain a per-request credit field. [Transcript credit tracking](https://docs.supadata.ai/get-transcript#tracking-credit-usage), [transcript response formats](https://docs.supadata.ai/get-transcript#response-format)

There are two qualifications:

1. The header statement appears in the transcript guide. Supadata's metadata and web-scrape guides and OpenAPI-generated API pages do not declare the header in their response schemas. The transcript guide says "each API response," which may describe the API globally, but the published contract does not remove that ambiguity. [Transcript credit tracking](https://docs.supadata.ai/get-transcript#tracking-credit-usage), [metadata response format](https://docs.supadata.ai/get-metadata#response-format), [web-scrape API reference](https://docs.supadata.ai/api-reference/endpoint/web/scrape)
2. Supadata's official JavaScript SDK does not expose response headers. Its client reads `content-type`, parses the JSON body, and returns only that body. Code using `@supadata/js` cannot read `x-billable-requests` without changing the transport or bypassing the SDK. [Official JavaScript SDK client](https://github.com/supadata-ai/js/blob/main/src/client.ts#L45-L95)

## Endpoint-by-endpoint result

| Operation | Documented charge | What can be treated as known |
| --- | ---: | --- |
| Native transcript, HTTP 200 | 1 credit | The charge is fixed by contract. The transcript guide also documents `x-billable-requests` as the actual credits for that request. |
| Transcript unavailable, HTTP 206 | 1 credit | This is an explicitly billed error-like response. Record 1 even if the header is missing, but mark its source as contract-derived rather than header-observed. |
| Metadata | 1 credit | The charge is fixed for every metadata request, regardless of platform or media type. The metadata response documentation does not itself promise the billing header. |
| Web scrape | 1 credit per URL | A call made as the link-import fallback costs 1 credit. A link handled without calling Supadata costs 0 Supadata credits. The scrape response documentation does not itself promise the billing header. |

Sources: [transcript pricing, including native and 206](https://docs.supadata.ai/get-transcript#pricing), [metadata pricing](https://docs.supadata.ai/get-metadata#pricing), [Supadata pricing page](https://supadata.ai/pricing), [web-scrape response](https://docs.supadata.ai/web/scrape#response-format).

Generated transcripts differ from the fixed-price cases above. Supadata charges two credits per video minute, so `x-billable-requests` matters if generated mode is ever enabled. The source or HTTP request count alone would not reveal the charge. [Transcript pricing](https://docs.supadata.ai/get-transcript#pricing)

## Errors and a missing header

Supadata explicitly documents billing for HTTP 206, but it does not say whether other transcript failures, metadata failures, or scrape failures consume credits. Its error catalog defines the response statuses and JSON error shape, not their billing treatment. A failed request without `x-billable-requests` therefore has unknown credit consumption. It must not silently become zero. [Supadata error catalog](https://docs.supadata.ai/errors/list), [transcript unavailable](https://docs.supadata.ai/errors/transcript-unavailable)

Supadata offers two fallback observations, neither of which replaces the missing per-request value:

- The dashboard has request history with credits used for each request.
- `GET /v1/me` returns `usedCredits` for the current billing period, but that is an account total and cannot attribute a delta safely when requests overlap.

Sources: [transcript credit tracking](https://docs.supadata.ai/get-transcript#tracking-credit-usage), [account information endpoint](https://docs.supadata.ai/api-reference/endpoint/account/me).

## Implementation consequence

Use direct server-side HTTP and read `x-billable-requests` before parsing or throwing on the response. Store the observed value when it is present. For fixed-price completed operations and the documented 206 case, a missing header can fall back to a contract-derived value with distinct provenance. For every other missing-header or transport-failure case, store the credit amount as unknown.

The remaining uncertainty is narrow but real: Supadata does not publish the header's value format, does not clearly guarantee it on metadata and scrape responses, and does not document its presence or billing meaning for errors other than 206. Representative live calls with an API key should verify those cases during implementation.
