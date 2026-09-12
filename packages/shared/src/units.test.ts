import assert from "node:assert/strict";
import test from "node:test";

import { convertUnitAmount, normalizeUnit } from "./units";

void test("standard unit spellings normalize without interpreting custom or missing units", () => {
  for (const [input, expected] of [
    ["  GRAMS  ", "g"],
    ["Gram", "g"],
    ["kilograms", "kg"],
    ["ounces", "oz"],
    ["lbs", "lb"],
    ["LBS.", "lb"],
    ["pound", "lb"],
    ["pounds", "lb"],
    ["millilitres", "ml"],
    ["milliliters", "ml"],
    ["deciliters", "dl"],
    ["litres", "l"],
    ["CUPS", "cup"],
    ["SS", "tbsp"],
    ["ts", "tsp"],
    ["stk", "pcs"],
    ["pieces", "pcs"],
    ["  Large Cheeks  ", "Large Cheeks"],
    ["cheek", "cheek"],
    ["cheeks", "cheeks"],
    ["fl oz", "fl oz"],
    ["", null],
    ["  ", null],
    [null, null],
  ] as const) {
    assert.equal(normalizeUnit(input), expected, String(input));
  }
});

void test("defined weight and volume conversions work in both directions using standard spellings", () => {
  for (const [amount, from, to, expected] of [
    [0.5, "kg", "g", 500],
    [400, "g", "kg", 0.4],
    [1, "lb", "g", 453.59237],
    [453.59237, "grams", "lbs.", 1],
    [1, "ounce", "g", 28.349523125],
    [28.349523125, "g", "oz", 1],
    [1, "lb", "oz", 16],
    [16, "OZ", "LB", 1],
    [1, "l", "ml", 1000],
    [250, "ml", "litres", 0.25],
    [1, "dl", "ml", 100],
    [250, "ml", "dl", 2.5],
    [2, "decilitres", "l", 0.2],
    [0.5, "l", "dl", 5],
    [400, " grams ", "G", 400],
  ] as const) {
    const actual = convertUnitAmount(amount, from, to);
    assert.ok(actual !== null, `${from} to ${to}`);
    assert.ok(
      Math.abs(actual - expected) < 1e-9,
      `${amount} ${from} to ${to}: ${actual}`,
    );
  }
});

void test("unsupported and incompatible units have no conversion in either direction", () => {
  for (const [from, to] of [
    ["g", "ml"],
    ["cup", "ml"],
    ["tbsp", "tsp"],
    ["ss", "ml"],
    ["ts", "ml"],
    ["pcs", "g"],
    [null, "pcs"],
    [null, "g"],
    [null, null],
    ["", "g"],
    ["cheek", "g"],
    ["cheek", "cheeks"],
    ["cheek", "cheek"],
    ["fl oz", "oz"],
    ["US cup", "ml"],
  ] as const) {
    assert.equal(convertUnitAmount(1, from, to), null, `${from} to ${to}`);
    assert.equal(convertUnitAmount(1, to, from), null, `${to} to ${from}`);
  }
});

void test("conversion never returns a non-finite quantity", () => {
  for (const amount of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    assert.equal(convertUnitAmount(amount, "kg", "g"), null);
  }
});
