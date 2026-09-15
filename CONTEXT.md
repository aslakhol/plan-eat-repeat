# Meal Planning

Plan Eat Repeat helps a household maintain a shared collection of dinners, assign them to calendar days, and keep a shared shopping list.

## Language

**Household**:
One or more people who share one Cookbook, one set of Plan Slots, and one Shopping List.
_Avoid_: Account, family

**Dinner**:
A reusable, household-owned meal idea with a name. A Dinner may have tags, notes, and an optional Recipe.
_Avoid_: Meal, dish, recipe

**Recipe**:
The optional structured cooking content attached to a Dinner. A Recipe may contain multiple named parts, ingredients, and steps; it is not managed independently from its Dinner.

**Recipe Ingredient**:
A named ingredient within a Recipe part, with an optional positive numeric Amount, Unit, and Ingredient Note. Its name is required; it has no free-text alternative to Amount.

**Amount**:
The positive number specifying how much of a Recipe Ingredient or Shopping Item is needed. An absent Amount leaves the quantity unspecified.

**Unit**:
The optional measure for a Recipe Ingredient or Shopping Item. It may be a recognised Standard Unit or arbitrary wording such as "cheek" or "handful"; an absent Unit is unspecified and distinct from pieces.

**Standard Unit**:
A Unit recognised by the application, with a preferred abbreviation and equivalent spellings. Defined conversions relate compatible measurements without depending on the ingredient.

**Ingredient Note**:
Optional wording accompanying a Recipe Ingredient, such as preparation details or serving instructions.

**Name-only Dinner**:
A Dinner that has a name but no Recipe or notes.
_Avoid_: Bare dinner, empty dinner

**Notes-only Dinner**:
A Dinner that has notes but no Recipe.
_Avoid_: Recipe-less dinner, un-recipe'd dinner

**Cookbook**:
The Household's collection of active Dinners.
_Avoid_: Dinner library, Dinners

**Shopping List**:
The Household's shared collection of items still to buy, added manually or from Dinners. Items leave the list when taken into the basket.

**Shopping Item**:
A requirement to buy an Own Item, with an optional Amount and Unit. It is independent of the Dinner or Recipe Ingredient it may have come from.

**Shopping Note**:
Optional wording qualifying an Own Item without changing its product name, such as "duck" for Eggs.

**Shopping Category**:
A store-oriented grouping of Shopping Items used to order the Shopping List.

**Own Item**:
A Household's saved combination of a product name and optional Shopping Note, with its own Shopping Category and Usually Have setting, whether the name originated in the standard catalog or was entered by the Household. It remains available for reuse independently of the Shopping List and Recently Used; Amount and Unit belong to requirements to buy it, not to the Own Item.
_Avoid_: Shopping Product

**Standard Shopping Item**:
A predefined product name with a Shopping Category, supplied in the English or Norwegian shopping catalog.

**Shopping Language**:
The Household's selected language for Standard Shopping Item matching and Shopping Category labels, either English or Norwegian.

**Remembered Shopping Category**:
The Household's category for an Own Item, whether chosen manually or assigned automatically, including the Own Items Category. It survives removal from the Shopping List and is independent of categories assigned to other Own Items with the same name and different notes.

**Category Inheritance**:
The initial assignment of a new Own Item's Shopping Category from a matching Own Item or Standard Shopping Item. The new Own Item keeps its Remembered Shopping Category when the source item's category later changes.

**Own Items Category**:
The fallback Shopping Category for names without a category match, labelled "Own Items" and ordered after all other Shopping Categories. Own Items can belong to any Shopping Category.

**Usually Have**:
The Household's set of Own Items to place in Recently Used instead of its Shopping List when adding from Dinners. Each name-and-note combination has its own setting; membership neither prevents manual additions nor removes existing Shopping Items.

**Recently Used**:
The Household's reusable Own Items from Shopping List removals and Usually Have exclusions when adding from Dinners, shown most recent first without time-based expiry, with at most 25 Own Items and none currently on the Shopping List. Each entry retains its latest Amount and Unit for restoration; different Shopping Notes distinguish entries even when their product names match.

**Plan Slot**:
The assignment of one Dinner to one Household calendar date. A Plan Slot identifies a date, not an instant in time.
_Avoid_: Plan entry, planned day

**Cooking History**:
The Household's past Plan Slots, which are presumed to represent Dinners that were cooked. Changing or clearing a past Plan Slot corrects this history; deleting a Dinner removes its history.

**Cooking Frequency**:
The number of past Plan Slots in which a Dinner occurs for the Household.

**Favourite**:
A Household-shared designation applied to a Dinner.
_Avoid_: Personal favourite, favorite

**Import Draft**:
Unsaved Dinner editor content produced from an import source. It changes the Cookbook only when the user saves it; cancelling discards it.

**AI Import Attempt**:
A Household member's request to produce an Import Draft from an import source. It may succeed, fail, or be cancelled, and remains distinct from any Dinner later saved from the draft.

**Import Prompt**:
The editable instructions that guide how AI turns an Import Source's content into a structured Recipe. They may request adaptations that substantially change the source Recipe.

**System Default Prompt**:
The application's default Import Prompt, followed by Households without a saved Household Prompt. These Households receive changes to the default automatically.

**Household Prompt**:
A saved Import Prompt shared by a Household. A Household without one follows the System Default Prompt.
_Avoid_: Household preferences

**AI Import Spend**:
The provider charges attributable to an AI Import Attempt. It consists of AI Import Cost and Supadata Credit Spend, which remain separate measures and are never converted into one another.
_Avoid_: Import cost, combined cost

**AI Import Cost**:
The estimated model provider charge attributable to AI inference during an AI Import Attempt. It belongs to the Household and may also be attributed to the initiating Household member; it excludes the ordinary infrastructure cost of running Plan Eat Repeat.
_Avoid_: Token cost, infrastructure cost

**AI Import Inference Usage**:
The provider, requested and response model identifiers, and total input and output tokens reported for an AI Import Attempt. It records model use whether or not the attempt produces an Import Draft and does not describe product outcome.

**Supadata Credit Spend**:
The Supadata credits attributable to acquisition work during an AI Import Attempt. It remains denominated in credits and is not part of AI Import Cost.
_Avoid_: Supadata cost, scraping cost

**Import Source**:
The kind of input submitted for an AI Import Attempt: YouTube, Instagram, Link, Text, or Photo.
_Avoid_: Import type

**System Admin**:
A trusted Plan Eat Repeat operator who may inspect AI Import Spend across Households. This role is distinct from a Household administrator.
_Avoid_: Admin, Household admin, super admin

**Link**:
The optional HTTP(S) URL associated with a Dinner. It often identifies the source of a Recipe, but may point somewhere else chosen by the Household.
_Avoid_: Source Link, Recipe link

**Clear Recipe**:
An editor action that removes a Dinner's Recipe parts and serving count while preserving its name, tags, notes, and Link.

**Merge Dinners**:
An irreversible Cookbook action that retains one of two household Dinners, preserves every distinct past and future planned date under it, and then deletes the other without combining Dinner content.
_Avoid_: Merge Cooking History, combine recipes

**Published Dinner**:
A search-indexable public view of a Dinner, created explicitly by any Household member and readable by anyone while sharing is enabled. Every Dinner can be published, including a Name-only Dinner or Notes-only Dinner; it presents the Dinner's current name, tags, notes, Link, and optional Recipe, and its attribution uses the Household's name.
_Avoid_: Public Recipe, shared Recipe

**Shared Dinners**:
The Household's view of its currently Published Dinners. It is a collection view, not a separate kind of Dinner.
_Avoid_: Shared Dinner entity, Published Dinner library

**Public Dinner List**:
The public view of one Household's currently Published Dinners. It exists only while that Household has at least one Published Dinner.
_Avoid_: Public Cookbook, Shared Dinners

**Publication Date**:
The UTC calendar date on which sharing was most recently enabled for a Published Dinner. It resets when sharing restarts and is used in both public attribution and share status.

**Published Dinner Copy**:
An ordinary, detached Dinner created by saving a Published Dinner into a Cookbook. It copies the current public content but reuses only case-insensitively matching tags already present in the destination Cookbook, creates no tags, and has no user-visible connection to its source.
_Avoid_: Synced Dinner, imported Dinner

**Save Intent**:
A visitor's request to add a Published Dinner to their Cookbook. It survives authentication, resolves to an existing matching Dinner unless explicitly asked to make another copy, and completes only while the source remains published.

**Save Count**:
The number of distinct destination Cookbooks currently containing at least one direct Published Dinner Copy. It excludes the source Cookbook and persists across periods when sharing is stopped, while the interface describes it as “saved by N people.”
