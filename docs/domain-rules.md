# Domain rules

## Recipes and units

Recipe Ingredients require a name and have no free-text alternative to Amount. Arbitrary units, standard-unit aliases, and ingredient-independent conversions are covered by [Allow arbitrary units with numeric amounts](adr/0016-allow-arbitrary-units-with-numeric-amounts.md).

## Shopping

Shopping Items retain their Dinner associations until they leave the Shopping List, independently of the originating Recipe Ingredients.

The Own Items Category is labelled "Own Items" and ordered after all other Shopping Categories.

Turning Usually Have on while editing a Shopping Item moves it to Recently Used, preserving its saved Amount and Unit. Manual additions remain allowed. Subsequent edits with Usually Have already on keep the item on the Shopping List.

Recently Used entries are ordered most recent first, have no time-based expiry, and are limited to 25 Own Items. Own Items currently on the Shopping List are excluded. Each entry retains its latest Amount and Unit for restoration; different Shopping Notes distinguish entries even when names match.

Related decisions:

- [Remember own items by name and note](adr/0018-remember-own-items-by-name-and-note.md) covers reusable identity, category memory, and Usually Have ownership.
- [Resolve recipe ingredients with complete words](adr/0019-resolve-recipe-ingredients-with-complete-words.md) covers recipe resolution before Jev matching.
- [Share Oda shopping transfers within the household](adr/0020-share-oda-shopping-transfers-within-the-household.md) covers shared authorization, cart fulfillment, and when Shopping Items leave the list.
- [Classify new Own Items with Jev](adr/0021-classify-new-own-items-with-jev.md) and [Match typed shopping items with Jev](adr/0022-match-typed-shopping-items-with-jev.md) distinguish category classification from identity matching, define confidence handling, and preserve remembered categories when reusing Own Items. ADR 0022 supersedes parts of ADR 0021.

## Cooking History

Changing or clearing a past Plan Slot corrects Cooking History. Deleting a Dinner removes its history, as recorded in [Delete Dinners with their Plan Slots](adr/0001-delete-dinners-with-plan-history.md).

## AI importing

System Default Prompt updates reach Households without a saved Household Prompt; saved overrides remain independent. See [Follow system prompt updates only without a household override](adr/0014-follow-system-prompt-updates-only-without-a-household-override.md).

The provider and model identifiers and token totals retained for AI Import Inference Usage are specified in [Retain AI import inference usage](adr/0013-retain-ai-import-inference-usage.md).

## Published Dinners

Every Dinner can be published, including a Name-only Dinner or Notes-only Dinner. Publication is explicit and available to every Household member. The public view shows the Dinner's current name, tags, notes, Link, optional Recipe, and attribution using the Household's name.

A Public Dinner List exists only while the Household has at least one Published Dinner. Its URL lifecycle is covered by [Keep Public Dinner List URLs Stable](adr/0009-keep-public-dinner-list-urls-stable.md).

Restarting sharing resets the Publication Date, which is used in public attribution and share status.

A Published Dinner Copy copies the current public content, reuses only case-insensitively matching tags already in the destination Cookbook, and creates no tags. It has no user-visible connection to its source.

A Save Intent survives authentication and resolves to an existing matching Dinner unless the visitor explicitly asks to make another copy. It completes only while the source remains published. See [Bootstrap a Household When Saving a Published Dinner](adr/0005-bootstrap-a-household-when-saving.md) for visitors without a Household.

Save Count excludes the source Cookbook and persists while sharing is stopped. The interface describes it as "saved by N people", although the count is of distinct Cookbooks.
