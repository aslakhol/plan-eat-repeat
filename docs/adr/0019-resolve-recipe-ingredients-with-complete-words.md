# Resolve recipe ingredients with complete words

Recipe additions prefer an exact Own Item, then an exact Standard Shopping Item, then a match whose entire note-free item name occurs as complete words in the ingredient name; unmatched ingredient words become the Shopping Note. Among non-exact matches, prefer the one covering the most ingredient words, and preserve the original name if equally good matches produce different results; imports never complete prefixes or introduce absent product words or saved notes. This deliberately permits interpretations such as Chocolate eggs becoming Eggs with a chocolate note: the Household can correct the resulting Own Item to Chocolate eggs, whose exact match then takes precedence on future imports.

Recipe Ingredient Notes describe preparation and do not contribute to Shopping Notes. Recipe Amount and Unit remain on the shopping requirement independently of the resolved Own Item.
