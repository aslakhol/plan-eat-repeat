# AI import spend manual verification

The [testing policy](../agents/testing.md) leaves internal admin functionality to manual verification.

When changing spend collection or the dashboard:

- Open the dashboard as the configured System Admin. Check that an ordinary user cannot open it or call its reporting query.
- Inspect a period containing imports, an empty period, and older history. Check that totals and source groups look plausible.
- Try a Text or Photo import and a Supadata-backed import. Compare the recorded source and charges with the provider response or billing dashboard where useful.
- Try a failed or cancelled import. Check that unknown charges remain distinguishable from zero and that reporting does not change the import outcome.

Dollars and Supadata credits are separate measures. The app estimates model charges; provider billing remains the place to investigate discrepancies. Full Clerk signup and live-provider recipe imports are also manual smoke checks.
