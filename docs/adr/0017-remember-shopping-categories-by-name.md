# Remember shopping categories by name

Name-based identity, category ownership, destination-category precedence on rename, and name-wide deletion behavior are superseded by [ADR 0018](0018-remember-own-items-by-name-and-note.md).

A Household remembers each shopping name's category, including automatically inherited categories, after the item leaves its Shopping List. Changing a name's category updates that name's existing and future items, but does not recategorize longer names that previously inherited it; new names can inherit the changed category. This preserves the Household's past assignments instead of repeatedly inferring categories from mutable matching names, and requires category memory to outlive active Shopping Items and Recently Used entries without prescribing whether those records are retained or deleted.

Category assignment happens when a Shopping Product first enters the Shopping List, Recently Used, or Usually Have. Own Items is a remembered assignment too, but never supplies a category through partial matching. Changing Shopping Language changes category labels and the standard names available for matching; remembered products remain available, while unused standard names from the previous language do not.

Renaming to a new name preserves the category without running automatic category inference again. Renaming to an already remembered name uses the destination's category as part of merging, so a rename does not overwrite that name's established category.

The item drawer's Delete own item action explicitly forgets a Shopping Product, including its active requirements, Recently Used entry, Usually Have membership, and category memory. Adding the name again uses the current matching rules. Other products that inherited its category keep their own assignments. Checking off items and clearing the Shopping List continue to preserve product memory.
