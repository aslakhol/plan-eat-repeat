const standardUnits = [
  {
    symbol: "g",
    aliases: ["gram", "grams"],
    conversion: { base: "g", factor: 1 },
  },
  {
    symbol: "kg",
    aliases: ["kilogram", "kilograms", "kilo", "kilos"],
    conversion: { base: "g", factor: 1000 },
  },
  // Avoirdupois weights, NIST SP 1020 conversion table:
  // https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=200329
  {
    symbol: "oz",
    aliases: ["oz.", "ounce", "ounces"],
    conversion: { base: "g", factor: 28.349523125 },
  },
  {
    symbol: "lb",
    aliases: ["lb.", "lbs", "lbs.", "pound", "pounds"],
    conversion: { base: "g", factor: 453.59237 },
  },
  {
    symbol: "ml",
    aliases: ["millilitre", "millilitres", "milliliter", "milliliters"],
    conversion: { base: "ml", factor: 1 },
  },
  {
    symbol: "dl",
    aliases: ["decilitre", "decilitres", "deciliter", "deciliters"],
    conversion: { base: "ml", factor: 100 },
  },
  {
    symbol: "l",
    aliases: ["litre", "litres", "liter", "liters"],
    conversion: { base: "ml", factor: 1000 },
  },
  { symbol: "cup", aliases: ["cups"], conversion: null },
  {
    symbol: "tbsp",
    aliases: [
      "tbsp.",
      "tablespoon",
      "tablespoons",
      "ss",
      "spiseskje",
      "spiseskjeer",
    ],
    conversion: null,
  },
  {
    symbol: "tsp",
    aliases: ["tsp.", "teaspoon", "teaspoons", "ts", "teskje", "teskjeer"],
    conversion: null,
  },
  {
    symbol: "pcs",
    aliases: ["pc", "piece", "pieces", "stk", "stk.", "stykk", "stykker"],
    conversion: null,
  },
] as const;

export const UNITS = standardUnits.map(({ symbol }) => symbol);

const unitBySpelling = new Map<string, (typeof standardUnits)[number]>(
  standardUnits.flatMap((unit) =>
    [unit.symbol, ...unit.aliases].map((spelling) => [spelling, unit] as const),
  ),
);

export const normalizeUnit = (unit: string | null) => {
  const trimmed = unit?.trim();
  if (!trimmed) return null;
  return unitBySpelling.get(trimmed.toLowerCase())?.symbol ?? trimmed;
};

// Only defined measurements can be converted; matching custom units or counts
// can be added separately without inventing a conversion factor.
export const convertUnitAmount = (
  amount: number,
  fromUnit: string | null,
  toUnit: string | null,
) => {
  const from = unitBySpelling.get(
    fromUnit?.trim().toLowerCase() ?? "",
  )?.conversion;
  const to = unitBySpelling.get(toUnit?.trim().toLowerCase() ?? "")?.conversion;
  if (!from || !to || from.base !== to.base) return null;
  const converted = amount * (from.factor / to.factor);
  return Number.isFinite(converted) ? converted : null;
};
