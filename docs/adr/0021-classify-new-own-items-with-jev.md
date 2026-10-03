# Classify new Own Items with Jev

Matching typed input against Own Items and Standard Shopping Items is covered by [ADR 0022](0022-match-typed-shopping-items-with-jev.md).

Jev assigns the category whenever a new Own Item is created, using its product name, Shopping Note, Shopping Language, and category descriptions. This replaces category inheritance from autocomplete sources, exact catalog matches, and partial name matches, so all new Own Items receive the same classification treatment. Reusing an existing Own Item retains its saved category and makes no Jev request; resolving input against known Own Items remains outside Jev's scope.

Call Jev synchronously through Vercel AI SDK and AI Gateway to try its low-latency classification without introducing background recategorization. Use gateway model `typesafe-ai/jev` with `AI_GATEWAY_API_KEY`. Accept classifications with Jev confidence of at least 0.4. Below-cutoff answers, API errors, and a three-second timeout fall back to Own Items, with no automatic retries or later background updates.

When an addition creates several Own Items, classify them in one request with a separate question and confidence check per item. The three-second timeout applies to the whole request. A failed request assigns Own Items to every new item; a successful request can accept some classifications while falling back for others.

Users can still correct categories manually. Editing an existing Own Item does not trigger classification. Category assignment uses the existing Shopping Categories; matching input to an Own Item or Standard Shopping Item remains separate from choosing its category.

This supersedes the automatic category matching and inheritance rules in [ADR 0017](0017-remember-shopping-categories-by-name.md) and [ADR 0018](0018-remember-own-items-by-name-and-note.md). Existing saved categories remain remembered, including Own Items assignments.
