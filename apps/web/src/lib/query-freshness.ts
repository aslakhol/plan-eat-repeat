// Short-lived Household choices; writes invalidate the affected queries sooner.
export const shoppingChoicesQueryOptions = { staleTime: 30_000 };
// Category labels change only with Shopping Language.
export const shoppingCategoriesQueryOptions = { staleTime: 5 * 60_000 };
