# AI Import Spend rollout smoke matrix

Run this matrix after the migration and application deploy for issue #154. The dashboard is reporting, not billing reconciliation. Compare shapes and counters with the database and provider consoles, but do not expect the recorded estimates to reproduce an invoice.

## Pre-deploy checks

- Apply the AI Import Attempt migration before deploying application code. Do not backfill older requests.
- Configure `SYSTEM_ADMIN_CLERK_USER_IDS` separately in Production, Preview, and Development. Missing or empty configuration must deny everyone.
- Confirm each deployment points at its own database.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, and the web test suite.

## Access and dashboard checks

| Check | Expected result | Local result, 30 Aug 2026 |
| --- | --- | --- |
| Signed-out dashboard request | Clerk sign-in flow with the dashboard as the return URL | Pass in browser |
| Allowlisted User without a Household | Dashboard loads | Pass in reporting-query test; deployment smoke still required |
| Signed-in User outside the allowlist | 404 page; direct query returns `FORBIDDEN` | Query pass in automated test; page smoke requires a signed-in session |
| Household `ADMIN` outside the allowlist | Same denial as any other non-System Admin | Pass in reporting-query test |
| Missing allowlist | Every reporting query is denied | Pass in reporting-query test |
| Focus returns to the dashboard | One refetch occurs; no interval polling starts | Query options and rendered test pass |
| Desktop Dashboard v2 layout | Handoff hierarchy, measures, controls, charts, and colors | Pass at 1200 x 900 in browser |
| Narrow layout | No page overflow; controls, values, rankings, and chart details remain usable | Pass at 320 x 700 in browser |
| Empty and unknown data | Zero hero/summary values; no empty axes or pies; unknown counts disclosed without `>` totals | Pass at 320 x 700 in browser |
| Period and history controls | All periods work; All time pages by 30 days; changing period resets to the latest window | Pass in browser |
| Household and source controls | Both rankings, exclusive expansion, retained attribution, keyboard chart details, and clickable pie details work | Pass in browser |

## Import-attempt checks after deployment

Use fresh, non-sensitive recipes. For each row, record the AI Import Attempt ID privately while debugging, then verify only the dashboard aggregate. Do not add an attempt-level product view or log imported content.

| Attempt | Expected reporting observation | Local result, 30 Aug 2026 |
| --- | --- | --- |
| Text | Source Text; no Supadata operation; inference is estimated or unknown | Pass with controlled adapters and database-backed mutation test; live provider smoke not run |
| Photo | Source Photo; no Supadata operation; any observed inference is retained | Pass with controlled adapters and database-backed mutation test; live provider smoke not run |
| Direct Link | Source Link; local scrape records no Supadata call | Pass with controlled adapters and database-backed mutation test; live provider smoke not run |
| Fallback Link | Source Link; one started Supadata operation; known credits settle or remain unknown | Pass with controlled adapters; live provider smoke not run |
| YouTube | Source YouTube; actual transcript and metadata operations determine credits | Pass with controlled provider responses; live provider smoke not run |
| Instagram image | Source Instagram; metadata operation only when no transcript is requested | Pass with controlled provider responses; live provider smoke not run |
| Instagram video | Source Instagram; metadata and transcript observations are retained independently | Pass with controlled provider responses; live provider smoke not run |
| Failed acquisition | Attempt finishes; spend already observed remains; unresolved operation stays unknown | Pass with controlled adapters |
| Cancelled acquisition | Cancellation behavior is unchanged; spend already observed remains | Pass with controlled adapters |
| Stale attempt before inference | After five minutes, reporting counts effective no-charge without updating the row | Pass in pure and database-backed reporting tests |
| Stale attempt after inference starts | After five minutes, reporting counts effective unknown without updating the row | Pass in pure and database-backed reporting tests |

Live provider smoke was not run locally because this checkout has no authorized rollout target or approval to create billable provider traffic. Run those rows in the target deployment after configuration, then inspect the Anthropic and Supadata consoles as supporting evidence. Credits remain credits; do not convert them to USD or present a remaining quota.

## Local verification record

- Web unit and database integration suite: 261 passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed for all workspaces.
- `pnpm build`: passed. Next emitted existing dependency and prerender connection warnings, but produced the System Admin route as a dynamic server-rendered page.
