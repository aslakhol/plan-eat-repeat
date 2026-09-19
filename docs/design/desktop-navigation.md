# Desktop navigation handoff decisions

Agreed on 19 September 2026 after reviewing the Top Bar Handoff against the app.

## Agreed

- Replace the signed-in desktop sidebar with the handoff's top bar.
- Keep Plan, Cookbook and Shopping List at their current 672px content width. Move Settings into the same centered column. Keep the AI dashboard wide.
- Use Cookbook as the navigation label, consistent with the existing domain glossary and mobile navigation.
- Show AI dashboard in the top bar only to System Admins. Add the bar to the AI dashboard, which currently has a separate layout.
- Preserve the existing public-page navigation and sign-in visibility rules.
- Keep Add Dinner available while creating or editing a Dinner.
- The bar scrolls with the page. It is not sticky.
- At narrow desktop widths, replace the wordmark with the crossed-utensils logo. Keep one row and relax exact content alignment where needed to fit the controls.
- Keep the existing mobile navigation below 768px.
- Show Add item on Shopping List and Usually have. Show Add Dinner on other pages.
- On Usually have, Add item opens the same shopping-item flow as on Shopping List, with the same behavior. It adds to the Shopping List and does not replace or operate the page's existing Add an ingredient form for Usually have.
- Retain Shopping List's existing in-page Add an item controls, including its empty state.
- Preserve the existing Dinner creation flow on the AI dashboard: cancelling the new-Dinner editor goes to Cookbook; saving opens the Dinner.

## Facts checked

- Account controls and sign-out already live in Settings.
- AI dashboard access belongs to System Admins, not Household administrators.
- The handoff's common 820px column does not exist in the current app.
- Public Dinner and Household sharing pages use a separate layout.
- Before this change, the Shopping List add flow was mounted only on Shopping List. Making the same flow available on Usually have is part of this change.

No domain terms changed. These reversible navigation choices do not require an ADR.
