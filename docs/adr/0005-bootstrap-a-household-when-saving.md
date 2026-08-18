# Bootstrap a Household When Saving a Published Dinner

When an authenticated visitor with no Household completes a Save Intent, the system atomically creates a one-person Household, Membership, and Published Dinner Copy before showing the saved state. The required Household name is derived from the authenticated user with “My household” as fallback, and the visitor can immediately plan or open the Dinner without completing the existing onboarding flow; we accept implicit Household creation to preserve the promise that authentication is the only interruption before saving.
