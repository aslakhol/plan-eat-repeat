export const normalizeShoppingName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

export const capitalizeShoppingName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\p{L}/u, (letter) => letter.toUpperCase());
