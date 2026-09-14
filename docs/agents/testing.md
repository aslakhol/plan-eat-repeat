# Testing policy

This is a family-and-friends project. Keep tests that catch meaningful failures without making routine changes expensive.

- Test domain rules, data preservation, Household boundaries, import reliability, and asynchronous behaviour such as cancellation and stale responses.
- Keep a few Playwright journeys for creating and editing Dinners, planning, and shopping. Use browser tests for navigation, authentication continuation, draft persistence, and other behaviour lower-level tests cannot establish.
- Test shared behaviour once. Keep additional cases when they exercise a different input format, execution path, or boundary. A different ID or source label with identical mocked behaviour adds no coverage.
- Assert observable outcomes through application code. Mock external dependencies to control failure and timing; avoid reproducing application logic in mocks or asserting private call sequences. Database tests should exercise application operations, except when checking an application-defined schema constraint or relation.
- Leave internal admin-specific functionality to manual verification, including its UI, reports, calculations, spend bookkeeping, and dedicated access controls. Shared code still warrants tests for its impact on ordinary user flows, such as an import succeeding when telemetry fails.
- Leave appearance, wording, and trivial novelty features to manual verification. Avoid exact CSS classes, colours, dimensions, duplicate markup counts, and prose snapshots. Labels used to locate controls are fine. Preserve protocol requirements such as safe JSON-LD serialization and public-page indexing.
- A small scrolling or reachability test may protect usability. Broad viewport and component matrices belong in visual inspection. Screenshot capture is a development tool, separate from the automated suite.

Use focused assertions in mixed tests. Remove low-value assertions without discarding useful behaviour. Judge a regression test by what it can catch, not its name or the issue that introduced it. This policy supersedes testing checklists in historical design and migration plans.

The Node suites use controlled provider responses. Browser tests reuse the existing local dev server and local login; they require the local database and Clerk development setup. Keep full third-party signup and live-provider checks as manual smoke verification.

Run `pnpm test` for unit tests, `pnpm test:integration` for database tests, and `pnpm test:e2e` for Playwright. The browser runner uses the existing server at `http://127.0.0.1:3000` (override with `PLAYWRIGHT_BASE_URL`); it does not start a server. Use `pnpm capture:web` separately for screenshots.
