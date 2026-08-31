## Problem Statement

Plan Eat Repeat pays for two independent resources when a Household member requests an AI Import Attempt: estimated model inference in USD and, for some Import Sources, Supadata credits used to acquire source material. The application currently retains neither measure. Provider consoles cannot attribute spend to a Household, initiating member, Import Source, or product request, so the System Admin cannot answer the practical question of whether recipe importing remains affordable or see where that spend comes from.

Supadata makes the old inference-only plan incomplete. YouTube normally uses transcript and metadata operations, Instagram may use one or two operations depending on the media and partial failures, and Link uses Supadata only when local scraping falls back. A fixed credit lookup by Import Source would misstate spend. Unknown provider charges and attempts that end before inference also need deliberate treatment.

Product outcome, success-rate, and reconciliation data remain outside this dashboard. Model identity and total token usage are retained separately so issue #193 can base an output-token limit on production data. This dashboard is a lightweight operational overview for one System Admin, not a billing ledger or analytics system.

## Solution

Record one reporting-focused AI Import Attempt for every authenticated, valid import request. The record keeps anonymous historical attribution, Import Source, lifecycle timestamps, a fixed estimated AI Import Cost, incrementally captured Supadata Credit Spend counters, model identity, and total input and output tokens. It does not retain imported content, product outcome, provider request identifiers, or raw provider usage.

Add an unlinked, System Admin-only AI Import Spend dashboard that presents inference USD and Supadata credits as separate measures. It provides rolling 24-hour figures, selectable calendar periods, daily history, Household and member attribution, Import Source breakdowns, unknown-charge counts, and links to the two provider consoles. The dashboard follows the supplied Dashboard v2 handoff at high fidelity while adding responsive and accessible behavior where the handoff is silent.

The application database remains the source of truth. Numeric totals sum the amounts the application recorded. Unknown charges add no numeric amount and appear as counts. Supadata credits are never converted to USD, and the dashboard does not show quotas, remaining allowance, budgets, forecasts, or alerts.

## User Stories

1. As the System Admin, I want to open an internal AI Import Spend dashboard, so that I can understand what recipe importing costs.

2. As the System Admin, I want the dashboard to work without belonging to a Household, so that product-level access is independent of Household administration.

3. As a signed-in non-System Admin, I want the internal route to appear unavailable, so that cross-Household spend is not disclosed.

4. As a signed-out visitor, I want normal authentication behavior when I reach the internal route, so that access follows the application's established sign-in flow.

5. As the System Admin, I want the page to identify Production, Preview, or Development, so that I know which database the figures describe.

6. As the System Admin, I want inference USD and Supadata credits shown separately, so that unrelated measures are not combined into a misleading total.

7. As the System Admin, I want a rolling Last 24 hours summary, so that I can spot recent activity quickly.

8. As the System Admin, I want the preceding 24 hours shown as the comparison, so that the comparison covers an equally long interval.

9. As the System Admin, I want 30-day mean and median daily spend, so that one unusually expensive day does not define my sense of normal use.

10. As the System Admin, I want early mean and median values based only on completed days since collection began, so that days before telemetry existed are not treated as zero-spend days.

11. As the System Admin, I want zero-spend days after collection began included in the mean and median, so that the figures represent actual daily use.

12. As the System Admin, I want to choose 7 days, 30 days, This month, or All time, so that I can inspect recent and historical spend without custom date controls.

13. As the System Admin, I want 7-day and 30-day periods defined as Oslo calendar dates including today, so that daily bars and period totals use the same boundaries.

14. As the System Admin, I want This month to use the Europe/Oslo calendar month, so that month reporting matches my local accounting context.

15. As the System Admin, I want period figures for inference spend and Supadata credits, so that I can see both kinds of spend at a glance.

16. As the System Admin, I want the number of AI Import Attempts and the subset that used Supadata, so that I can distinguish import volume from paid acquisition use.

17. As the System Admin, I want Active Households for the period, so that I can see how broadly the feature is used.

18. As the System Admin, I want Active Households compared with all represented Households, so that deleted historical Households do not make the denominator inconsistent.

19. As the System Admin, I want average inference spend per priced attempt, so that attempts that never reached inference do not dilute the estimate.

20. As the System Admin, I want average Supadata credits per AI Import Attempt, so that the acquisition cost reflects all product requests, including those that did not use Supadata.

21. As the System Admin, I want no-charge, pending, and unknown inference counts disclosed, so that the numeric estimate's blind spots remain visible.

22. As the System Admin, I want unknown Supadata operation counts disclosed, so that missing credit amounts do not silently look like known zero spend.

23. As the System Admin, I want numeric totals to remain ordinary sums without lower-bound symbols, so that this lightweight overview stays easy to scan.

24. As the System Admin, I want a daily chart with independent USD and credit axes, so that both measures remain legible without implying a conversion between them.

25. As the System Admin, I want daily tooltips with date, inference spend, credits, and attempt count, so that I can inspect a day without a separate detail page.

26. As the System Admin, I want All time history shown in at most 60-day windows that move 30 days at a time, so that the chart remains readable as history grows.

27. As the System Admin, I want changing the period to return the chart to its most recent window, so that stale paging state does not produce a confusing range.

28. As the System Admin, I want Households ranked by either inference USD or Supadata credits, so that I can identify the main source of each kind of spend.

29. As the System Admin, I want both Household spend bars to remain equally visible when ranking changes, so that ranking does not masquerade as filtering.

30. As the System Admin, I want Household bars based on their share of recorded period spend, so that the rows show each Household's contribution to the total.

31. As the System Admin, I want small non-zero Household and member shares to retain the designed visibility floor, so that low spend does not disappear visually.

32. As the System Admin, I want zero spend to render no bar, so that a visibility floor never turns zero into apparent spend.

33. As the System Admin, I want to expand a Household into members represented in the period, so that I can understand who initiated its AI Import Attempts.

34. As the System Admin, I want only one Household expanded at a time, with the first row initially open, so that the report remains compact.

35. As the System Admin, I want a live Household's current member count in its summary, so that the row still provides current context.

36. As the System Admin, I want former members and deleted Households grouped separately without their names, so that historical spend survives without retaining deleted identity details.

37. As a former member, I want my name and external identity-provider ID absent from retained spend history after my Membership is removed, so that reporting keeps only anonymous attribution.

38. As the System Admin, I want Import Source breakdowns for YouTube, Instagram, Link, Text, and Photo, so that I can see what kinds of requests drive volume and spend.

39. As the System Admin, I want separate source pies for attempts, inference spend, and Supadata credits, so that the same source taxonomy can be compared across all measures.

40. As the System Admin, I want Link attempts that succeed through local scraping counted as having no Supadata call, so that the dashboard does not infer credits from the source alone.

41. As the System Admin, I want Instagram image imports and video imports measured from their actual Supadata operations, so that both are represented accurately.

42. As the System Admin, I want attempts with uncertain Supadata billing counted as having used Supadata, so that failed or interrupted calls do not disappear from the usage ratio.

43. As the System Admin, I want empty chart, Household, and source states to explain that there are no AI Import Attempts in the period, so that blank graphics do not look broken.

44. As the System Admin, I want the collection start date shown, so that I know All time begins when telemetry was deployed and is not a historical backfill.

45. As the System Admin, I want direct links to Anthropic and Supadata billing consoles, so that I can inspect provider-owned billing information when needed.

46. As the System Admin, I want inference spend labeled as an estimate, so that the dashboard is not mistaken for an invoice.

47. As the System Admin, I want Supadata credits described as spent credits with no remaining allowance, so that the dashboard does not invent quota information the API does not provide.

48. As the System Admin, I want the page to remain usable on a narrow viewport, so that internal reporting is not limited to one desktop width.

49. As a keyboard user, I want period controls, paging, Household expansion, and chart information to be operable without a mouse, so that the dashboard is accessible.

50. As a touch user, I want information represented by hover interactions to remain available, so that tooltips are not the only way to understand the charts.

51. As a screen-reader user, I want meaningful text summaries for charts and semantic buttons for interactions, so that visual encoding is not the only source of information.

52. As a Household member, I want spend tracking failures to leave my recipe import behavior unchanged, so that reporting never prevents an Import Draft from being produced.

53. As a Household member, I want cancellation to stop import work as it does today, so that telemetry does not weaken cancellation behavior.

54. As the System Admin, I want a cancelled or failed AI Import Attempt to retain any spend already observed, so that product failure does not erase provider use.

55. As the System Admin, I want the dashboard to refresh when I return to its browser tab, so that figures do not remain stale through a work session.

56. As the System Admin, I do not want continuous polling, so that a low-priority dashboard does not create unnecessary database traffic.

## Implementation Decisions

- Use the domain terms AI Import Attempt, AI Import Spend, AI Import Cost, Supadata Credit Spend, Import Source, and System Admin. Do not use "import" as shorthand for a successful saved Dinner, and do not call a System Admin a Household administrator.

- Keep one deep recipe-import module as the external seam for tracked imports. Its interface accepts the validated import input, Household and initiating member attribution, and cancellation signal. Its implementation creates the AI Import Attempt before loading Household instructions or beginning acquisition, then owns instruction loading, source acquisition, inference, spend capture, lifecycle finalization, and best-effort tracking behavior. The three authenticated import mutations remain thin callers and do not operate a spend recorder directly.

- Treat one authenticated import mutation with valid input as one AI Import Attempt. Create it before any external acquisition or inference work. Producing an Import Draft, returning an import error, or observing cancellation finishes the attempt. Saving or discarding the later Import Draft does not change the attempt.

- Classify Import Source from the submitted input before external work. Recognized YouTube and Instagram URL forms retain those sources even when acquisition fails. Other URLs are Link. The dedicated text and photo mutations produce Text and Photo respectively. Provider fallback behavior does not rewrite the source.

- Add a single reporting-focused AI Import Attempt model. It contains an ID, Import Source, start and finish timestamps, optional live Household and Membership relations, copied anonymous Household and Membership attribution keys, inference state, inference start timestamp, nullable estimated USD amount, Supadata operations-started count, recorded credits, and unknown-operation count.

- Add random unique spend-attribution keys to Household and Membership. Copy both keys onto every attempt. Make the live relations optional and use nulling deletion behavior, so a deleted Household or removed Membership does not delete spend history. Do not copy names, User IDs, Clerk IDs, images, or other identity data into the attempt.

- Resolve display names only through live Household and Membership records. When the live record is gone, group its retained key separately as "Household unavailable" or "Member unavailable." A removed member who later joins another Household receives a new Membership attribution and does not reconnect the histories.

- Use four inference states: `PENDING`, `NOT_INCURRED`, `ESTIMATED`, and `UNKNOWN`. Start at `PENDING`. Finish as `NOT_INCURRED` when inference never began, `ESTIMATED` when the provider returned usable billing data and the app fixed an estimate, or `UNKNOWN` when inference began without usable billing data.

- Persist the inference-start timestamp, provider ID, and requested model ID immediately before calling the model. Capture the response model ID and total input and output tokens at the model-step callback, before structured-output parsing can reject a billed response. Calculate the current request's estimate at capture time. Keep the unrounded USD `Float` and round only for display.

- Keep the pricing function narrow. It recognizes only explicitly configured models. Missing usage or an unrecognized configured model produces `UNKNOWN` without failing the import. Store the provider ID, requested and response model IDs, and total input and output tokens. Do not store a pricing version, provider request identifiers, or raw usage.

- Accept the AI SDK retry blind spot. If a retry eventually succeeds, store the estimate from the successful response even though an earlier failed provider request might have incurred an unreported charge. Do not disable retries or add custom retry instrumentation for this feature.

- Capture Supadata at the metered-operation level while retaining only attempt counters. Immediately before a metered request, increment operations started and unknown operations. When a response header or a documented fixed-price completed result establishes credits, add the credits and decrement unknown operations. Free transcript-job polling does not increment these counters.

- Treat Supadata's valid `x-billable-requests` header as the credits consumed by that request. When that header is absent, use the documented fixed credit for a completed native transcript, metadata request, web scrape, or transcript-unavailable 206 response. Other failures, transport loss, cancellation without a response, malformed billing values, and undocumented cases remain unknown. Do not infer credits from Import Source.

- Sum recorded inference USD and recorded Supadata credits normally. An unknown charge has no numeric value and contributes zero to arithmetic only because no amount is available. Do not prefix totals with a lower-bound symbol. Disclose unknown counts in summary notes and in a footnote, while keeping charts, pies, Household rows, and legends visually clean.

- Make tracking writes best effort. A failure to create or update telemetry logs a sanitized server warning and never changes a successful or failed import into a different product result. Do not send telemetry failures to PostHog or add an observability dependency. Never log imported content, generated content, names, credentials, request headers, API keys, or provider response bodies.

- Attribute the complete attempt, its AI Import Cost, and all Supadata Credit Spend to the attempt's start date in Europe/Oslo. Do not split a request across dates when a provider call crosses midnight. Store timestamps normally and calculate reporting boundaries explicitly.

- Interpret 7 days as today plus the previous six Oslo calendar dates, 30 days as today plus the previous 29, This month as the Oslo month to date, and All time as the first recorded attempt through now. Last 24 hours remains a true rolling interval, compared with the immediately preceding 24 hours.

- Compute the mean and median from completed Oslo calendar days since collection began, capped at the most recent 30. Include zero-spend days after collection begins. Before 30 completed days exist, show the actual number of days in the note.

- During reporting, treat `PENDING` attempts older than five minutes as stale without mutating them. A stale attempt is effectively `NOT_INCURRED` when inference never started and `UNKNOWN` when it did. This avoids background cleanup infrastructure and keeps reporting read-only.

- Add one System Admin reporting query as the dashboard data seam. It accepts the selected period and chart offset, establishes one server-side `now`, and returns the complete aggregate projection for the hero, period summary, daily window, Households and represented members, Import Sources, environment label, collection date, and hard-coded billing links.

- Authorize the reporting query by signed-in Clerk User ID against an optional server-only allowlist. It must not require Household membership. Missing or empty configuration denies everyone. Household `ADMIN` membership never grants this access.

- Protect the page and query independently. Signed-out visitors follow normal authentication. Signed-in users outside the allowlist receive a 404 page, while unauthorized reporting calls return `FORBIDDEN`. Keep the route out of normal Household navigation.

- Aggregate on the server and return no raw attempt rows or cross-Household detail endpoint. Fetch only the narrow attempt fields needed for the applicable range and calculate the first version's metrics in TypeScript. Add indexes on start time and on each attribution key plus start time. Move selected aggregation into SQL only if measured volume makes the simple implementation slow.

- Define an Active Household as a distinct retained Household attribution with at least one attempt in the period. Define represented Households as all current Households plus unavailable retained Household keys. Use "of N represented" in the summary.

- In the expanded Household view, return only Membership attributions with at least one attempt in the period. Resolve live names where possible and use "Member unavailable" otherwise. The Household row's member count is the current live member count.

- Define average inference per priced attempt as recorded inference USD divided by `ESTIMATED` attempts only. Show no-charge, pending, and unknown inference counts alongside it. Define average credits per attempt as recorded Supadata credits divided by every AI Import Attempt in the period.

- Define "used Supadata" as having at least one Supadata operation started, regardless of known credits. Use "total / used Supadata" in the period summary, "N used Supadata" in the 24-hour hero, and "No Supadata call" in the source footer.

- Return all Household totals required for both rankings and sort them in the browser. Changing the ranking changes row order only. It does not recolor, fade, hide, or rescale the other measure.

- Keep page controls in local state. The period, chart offset, expanded Household, and ranking do not need shareable URLs or reload persistence. Changing the period clears hover state and returns the chart to its most recent window.

- Fetch on initial page load and on period or chart-window changes. Refetch when the browser regains focus. Do not poll continuously or add a manual refresh control.

- Follow the Dashboard v2 handoff as the visual authority. Recreate its single-column, maximum-width layout, Plan Eat Repeat typography, cards, spacing, semantic colors, chart colors, tooltips, segmented controls, and restrained transitions. Where the README and prototype constant disagree about the ordinary inference chart color, use the README value.

- Keep the Last 24 hours hero independent of the selected period. It shows inference USD, Supadata credits, the preceding 24-hour comparison, 30-day mean and median, active Households, AI Import Attempts, and attempts that used Supadata.

- Keep the selected-period summary to inference spend, Supadata credits, attempt and Supadata-use counts, Active Households, average inference per priced attempt, and average credits per attempt. Do not add model, outcome, token, or success-rate summaries.

- Build the daily chart from ordinary React and CSS, with two bars per date and independent axes. Show at most 60 dates. All time windows move 30 days per action and disable paging at each end. Tooltips expose date, both recorded measures, and attempt count. Add an accessible textual summary and non-hover access to the same information.

- Build Household share bars from recorded period totals. Preserve the designed 1 percent Household and 2 percent member visibility floors for non-zero values. The numeric shares remain exact even though the rendered floors need not add visually to 100 percent. Render zero with no filled bar.

- Build the three Import Source pies as inline SVG without a charting dependency. Use the fixed source colors and order from the handoff, omit zero-value slices, list non-zero values, and retain the designed hover details with keyboard and touch alternatives.

- Keep one Household expanded at a time and open the first returned Household by default. Use semantic buttons for expansion and paging. Preserve the designed empty Household state.

- Keep zero-valued hero and summary figures visible. Replace an empty daily plot and empty source pies with "No import attempts in this period." Do not render meaningless axes or pie slices.

- Add a usable narrow-screen layout by stacking cards and adapting tables without changing the information hierarchy. Every hover-only interaction needs keyboard and touch access. Charts require text equivalents, and interactive rows must use semantic controls.

- Derive the environment subtitle from deployment configuration: Production, Preview, or Development. Each deployment reads only its own database; no cross-environment aggregation exists.

- Hard-code the current Anthropic and Supadata billing-console URLs. Open them in a new tab with safe external-link attributes. Provider consoles supplement the application record and never become its source of truth.

- Start collection when the migration deploys. Do not backfill. The footnote shows the first attempt date and identifies inference as an estimate. It also explains that Supadata credits are recorded as spent, are never converted to USD, and have no displayed remaining allowance.

## Testing Decisions

- Test behavior through the highest useful seams. The primary capture seam is the deep recipe-import module, not its private recorder callbacks. The primary reporting seam is the single System Admin dashboard query and its aggregate projection. Tests should survive internal refactors that preserve those interfaces.

- Add focused pure tests for inference-price calculation, inference-state transitions, Supadata billing-header validation, fixed-price fallback, unknown-operation accounting, Import Source classification, Oslo period boundaries, rolling 24-hour boundaries, early collection windows, zero-day inclusion, mean and median calculation, Household representation, member grouping, and Import Source aggregation.

- Test the import module with controlled acquisition, model, and persistence adapters. Prove that it creates one attempt after authentication and input validation, records spend before later parsing failure, retains Supadata credit observations from partial acquisition, finalizes cancellation, and never changes the import result when a telemetry write fails.

- Add database integration coverage for atomic Supadata counter transitions, optional live relations, deletion and Membership-removal retention, anonymous grouping keys, stale pending interpretation, collection-date queries, and all required indexes and constraints.

- Test System Admin authorization through the reporting query. Cover an allowlisted User with no Household, a Household administrator who is not allowlisted, a signed-in non-System Admin, a signed-out request, and missing allowlist configuration.

- Test reporting as one coherent projection using a fixed `now`. Cover every period, an Oslo daylight-saving transition, All time paging bounds, attempts crossing midnight, deleted Households, former members, known and unknown charges in the same period, zero spend, and a period with no attempts.

- Test averages with their chosen denominators. Inference uses only `ESTIMATED` attempts. Credits use all attempts. Unknown amounts do not enter arithmetic, while unknown counts remain visible.

- Test UI behavior at the rendered page seam where practical. Cover period changes, chart-window reset and paging, both Household ranking modes, exclusive Household expansion, source and daily tooltips, empty states, focus refetch, and the absence of polling.

- Use browser verification for the high-fidelity handoff. Inspect the 7-day, 30-day, This month, and All time states; both ranking modes; an expanded Household; deleted-history rows; zero and unknown states; keyboard navigation; touch-equivalent information; and a narrow viewport. Compare desktop results with every supplied handoff screenshot.

- Follow existing prior art: Node's built-in test runner for focused module tests, the repository's database-backed integration-test pattern for Prisma behavior and router callers, and Playwright for browser-level behavior and visual inspection.

- Run the targeted import, provider, reporting, and integration tests, then run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. Lint and typecheck remain mandatory before opening a pull request.

- After deployment, smoke-test Text, Photo, direct Link, fallback Link, YouTube, Instagram image, and Instagram video AI Import Attempts. Confirm attempt counts, Import Sources, inference estimates, Supadata operations, and recorded credits. Exercise one failed or cancelled acquisition and confirm its unknown handling. Check representative live Supadata responses against the provider dashboard where useful, but do not build automated reconciliation.

## Out of Scope

- Product outcome, success rate, pricing-version history, provider request identifiers, raw provider usage, imported content, prompts, generated Recipe content, and per-provider-operation history.

- Retrospective answers that require those omitted fields. If they become useful later, collection begins when the new fields are introduced. Model identity and token history begin with the migration that adds those fields; earlier AI Import Attempts remain unknown.

- Anthropic Usage or Cost Admin API integration, automated invoice reconciliation, billing exports, external analytics storage, and a second observability product.

- Supadata remaining allowance, plan quota, automatic recharge, budgets, per-Household limits, forecasts, anomaly detection, alerts, and converting credits to USD.

- Historical backfill before deployment or aggregation across Production, Preview, and Development databases.

- Raw-attempt browsing, attempt-level drill-down, custom date ranges, model or outcome filters, success-versus-failure reports, and downloadable reports.

- A mobile-app dashboard. The web dashboard must still have a usable narrow-screen layout.

- Shareable control-state URLs, saved filters, continuous polling, and a manual refresh control.

- Adding a chart library or copying the design prototype's seeded generator into production.

- Changing provider acquisition behavior, Supadata transcript modes, provider retry behavior, recipe-import timeouts, or the existing cancellation contract.

- Setting an explicit model output-token ceiling. GitHub issue #193 tracks that separate safeguard.

- Updating a saved Dinner based on spend history or connecting an AI Import Attempt to a Dinner created from its Import Draft.

## Further Notes

- The canonical repository plan is `docs/plans/ai-import-spend-dashboard.md`. This issue carries the same spec for execution in the project tracker.

- This spec supersedes the previous body of issue #154, the inference-only dashboard recommendations in the dated Anthropic cost research, and the design handoff's fixed YouTube, Instagram, and Link credit assumptions. The dated research remains useful evidence, but this spec owns the implementation choices.

- ADR-0010 is superseded by ADR-0012. ADR-0011 governs anonymous attribution after Household or Membership deletion. ADR-0012 governs the single reporting-focused record and its deliberately omitted audit fields.

- Supadata's transcript documentation defines `x-billable-requests` as credits consumed by a request. The guarantee is less explicit for metadata and web scrape responses, and most error billing remains undocumented. The repository's dated Supadata credit-observability research records those limits.

- The application currently has no System Admin concept, AI Import Attempt table, spend capture, reporting query, dashboard page, or chart dependency. The authenticated import mutations already know the User and Household, and the Supadata adapters already inspect billing headers, which are the main implementation footholds.

- The design's percentage floors are visual aids. They do not need user-facing explanation and are not expected to make rendered widths total exactly 100 percent.

- The dashboard is intentionally approximate. Small floating-point differences and rounding are acceptable because its job is to give the System Admin a useful overview, not reproduce an invoice.
