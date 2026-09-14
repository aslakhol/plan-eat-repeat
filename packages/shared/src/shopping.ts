export const normalizeShoppingName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
