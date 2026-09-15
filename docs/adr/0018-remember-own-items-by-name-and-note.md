# Remember own items by name and note

A Household remembers each name-and-note combination as an Own Item with its own category, so recurring purchases such as Eggs with a duck note remain reusable after leaving the Shopping List and Recently Used. Creating an Own Item through autocomplete copies the source item's category unless the destination Own Item already exists, in which case its remembered category wins; subsequent category changes affect only that Own Item. Amount and Unit belong to shopping requirements rather than Own Items, and different Own Items never merge merely because their names match.

Own Item identity ignores capitalization and extra whitespace in both name and note while preserving display spelling. Punctuation remains meaningful, and an empty note is equivalent to no note.

Editing an Own Item's name, note, or category changes it for every shopping requirement that refers to it; editing Amount or Unit changes only the selected requirement. If an edit produces an existing name-and-note combination, the edited Own Item replaces the destination's saved definition, including its category and Usually Have setting, and the source combination is no longer remembered. Requirements for the resulting Own Item follow the existing quantity-merging rules, so compatible amounts combine rather than being discarded.

Recently Used distinguishes Own Items and retains each entry's latest Amount and Unit for restoration. Usually Have belongs to the complete Own Item, so recipe additions check the resolved item's setting. New Own Items start with Usually Have off, including variants derived from a source with it on; reusing an existing Own Item retains its setting. Manual additions remain allowed regardless of Usually Have. Additions from every source remember Own Items; displaying an autocomplete suggestion does not.

Deleting an Own Item forgets only that name-and-note combination and removes its active requirements, Recently Used entry, and Usually Have membership. It preserves other Own Items with the same name and their settings.

This supersedes the name-based identity, category ownership, destination-category precedence on rename, and name-wide deletion behavior in [ADR 0017](0017-remember-shopping-categories-by-name.md).
