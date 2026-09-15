import type { ShoppingCategory } from "@planeatrepeat/db";

// Order and bilingual labels from the approved catalog in issue #267.
export const shoppingCategories = {
  PRODUCE: { en: "Fruits & Vegetables", no: "Frukt og grønt" },
  BAKERY: { en: "Bread & Pastries", no: "Brød og bakevarer" },
  DAIRY: { en: "Milk & Cheese", no: "Meieriprodukter" },
  MEAT: { en: "Meat & Fish", no: "Kjøtt og fisk" },
  INGREDIENTS: { en: "Ingredients & Spices", no: "Ingredienser og krydder" },
  FROZEN: { en: "Frozen & Convenience", no: "Frysevarer og ferdigmåltid" },
  GRAINS: { en: "Grain Products", no: "Kornprodukter" },
  SNACKS: { en: "Snacks & Sweets", no: "Snacks og godteri" },
  BEVERAGES: { en: "Beverages", no: "Drikkevarer" },
  HOUSEHOLD: { en: "Household", no: "Husholdning" },
  CARE: { en: "Care & Health", no: "Omsorg & Helse" },
  PETS: { en: "Pet Supplies", no: "Dyreprodukter" },
  GARDEN: { en: "Home & Garden", no: "Hjem og hage" },
  OWN_ITEMS: { en: "Own Items", no: "Egne varer" },
} as const satisfies Record<ShoppingCategory, { en: string; no: string }>;

export const shoppingCategoryOrder = Object.keys(
  shoppingCategories,
) as ShoppingCategory[];
