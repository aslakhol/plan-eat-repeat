// Emits candidates.txt — a class-name corpus that Tailwind's JIT scans as
// "content", so the compiled design-system stylesheet carries a usable utility
// surface even for markup that does not exist yet (designs the Claude Design
// agent writes later).
//
// Two jobs, only one of which the repo's own source can do:
//   1. Classes the DS components themselves use     -> covered by the src glob.
//   2. Classes a design agent will reach for later  -> covered by this file.
//
// Keep it broad but curated: every entry costs bytes in the shipped stylesheet.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const push = (target, ...xs) => target.push(...xs.flat(Infinity).filter(Boolean));
const cross = (prefixes, names) =>
  prefixes.flatMap((p) => names.map((n) => `${p}${n}`));

// ── scales ────────────────────────────────────────────────────────────────
const SPACE = ["0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5",
  "6", "7", "8", "9", "10", "11", "12", "14", "16", "20", "24", "28", "32",
  "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96"];
const FRACTIONS = ["1/2", "1/3", "2/3", "1/4", "2/4", "3/4", "1/5", "2/5",
  "3/5", "4/5", "1/6", "5/6", "1/12", "5/12", "7/12", "11/12"];
const SIZE_KEYWORDS = ["auto", "full", "screen", "min", "max", "fit", "px"];
const MAXW = ["none", "0", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl",
  "5xl", "6xl", "7xl", "full", "min", "max", "fit", "prose", "screen-sm",
  "screen-md", "screen-lg", "screen-xl", "screen-2xl"];

const SEMANTIC = ["background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "border", "input", "ring", "sidebar", "sidebar-foreground",
  "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent",
  "sidebar-accent-foreground", "sidebar-border", "sidebar-ring"];
const BASE_COLORS = ["white", "black", "transparent", "current", "inherit"];
// Raw palettes are an escape hatch, not the vocabulary — the warm-stone theme
// is expressed through SEMANTIC. Kept narrow on purpose: every extra palette
// multiplies across prefixes and state variants.
const PALETTES = ["stone", "neutral", "gray", "slate", "red", "orange", "amber",
  "green", "emerald", "sky", "blue", "rose"];
const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];
const RAW_COLORS = PALETTES.flatMap((p) => STEPS.map((s) => `${p}-${s}`));
const OPACITIES = ["5", "10", "20", "50", "80", "90"];

// ── layout ────────────────────────────────────────────────────────────────
const LAYOUT = [];
push(LAYOUT, ["block", "inline-block", "inline", "flex", "inline-flex", "grid",
  "inline-grid", "table", "table-cell", "table-row", "contents", "hidden",
  "flow-root", "list-item"]);
push(LAYOUT, ["flex-row", "flex-row-reverse", "flex-col", "flex-col-reverse",
  "flex-wrap", "flex-wrap-reverse", "flex-nowrap", "flex-1", "flex-auto",
  "flex-initial", "flex-none", "grow", "grow-0", "shrink", "shrink-0",
  "basis-0", "basis-auto", "basis-full", "basis-1/2", "basis-1/3", "basis-1/4"]);
push(LAYOUT, cross(["items-"], ["start", "end", "center", "baseline", "stretch"]));
push(LAYOUT, cross(["justify-"], ["start", "end", "center", "between", "around", "evenly", "stretch"]));
push(LAYOUT, cross(["content-"], ["start", "end", "center", "between", "around", "evenly", "stretch"]));
push(LAYOUT, cross(["self-"], ["auto", "start", "end", "center", "stretch", "baseline"]));
push(LAYOUT, cross(["place-items-", "place-content-", "place-self-"], ["start", "end", "center", "stretch"]));
push(LAYOUT, cross(["grid-cols-"], ["none", "subgrid", ...Array.from({ length: 12 }, (_, i) => `${i + 1}`)]));
push(LAYOUT, cross(["grid-rows-"], ["none", ...Array.from({ length: 6 }, (_, i) => `${i + 1}`)]));
push(LAYOUT, cross(["col-span-"], ["full", ...Array.from({ length: 12 }, (_, i) => `${i + 1}`)]));
push(LAYOUT, cross(["row-span-"], ["full", ...Array.from({ length: 6 }, (_, i) => `${i + 1}`)]));
push(LAYOUT, cross(["col-start-", "col-end-"], Array.from({ length: 13 }, (_, i) => `${i + 1}`)));
push(LAYOUT, cross(["auto-cols-", "auto-rows-"], ["auto", "min", "max", "fr"]));
push(LAYOUT, ["grid-flow-row", "grid-flow-col", "grid-flow-dense"]);
push(LAYOUT, cross(["order-"], ["first", "last", "none", ...Array.from({ length: 12 }, (_, i) => `${i + 1}`)]));
push(LAYOUT, ["static", "relative", "absolute", "fixed", "sticky", "isolate"]);
push(LAYOUT, cross(["z-"], ["auto", "0", "10", "20", "30", "40", "50"]));
push(LAYOUT, cross(["inset-", "inset-x-", "inset-y-", "top-", "right-", "bottom-", "left-"],
  ["auto", "full", "1/2", ...SPACE]));
push(LAYOUT, cross(["-inset-", "-top-", "-right-", "-bottom-", "-left-"], ["1", "2", "3", "4", "px", "full"]));
push(LAYOUT, cross(["overflow-", "overflow-x-", "overflow-y-"],
  ["auto", "hidden", "clip", "visible", "scroll"]));
push(LAYOUT, ["float-left", "float-right", "float-none", "clear-both", "clear-none"]);
push(LAYOUT, cross(["object-"], ["contain", "cover", "fill", "none", "scale-down",
  "center", "top", "bottom", "left", "right"]));
push(LAYOUT, cross(["aspect-"], ["auto", "square", "video"]));

// ── spacing ───────────────────────────────────────────────────────────────
const SPACING = [];
push(SPACING, cross(["p-", "px-", "py-", "pt-", "pr-", "pb-", "pl-", "ps-", "pe-"], SPACE));
push(SPACING, cross(["m-", "mx-", "my-", "mt-", "mr-", "mb-", "ml-", "ms-", "me-"], [...SPACE, "auto"]));
push(SPACING, cross(["-m-", "-mx-", "-my-", "-mt-", "-mr-", "-mb-", "-ml-"], SPACE.slice(1, 20)));
push(SPACING, cross(["gap-", "gap-x-", "gap-y-"], SPACE));
push(SPACING, cross(["space-x-", "space-y-"], [...SPACE.slice(0, 22), "reverse"]));

// ── sizing ────────────────────────────────────────────────────────────────
const SIZING = [];
push(SIZING, cross(["w-"], [...SPACE, ...FRACTIONS, ...SIZE_KEYWORDS]));
push(SIZING, cross(["h-"], [...SPACE, ...FRACTIONS, ...SIZE_KEYWORDS, "svh", "dvh", "lvh"]));
push(SIZING, cross(["size-"], [...SPACE, "full", "fit", "auto"]));
push(SIZING, cross(["min-w-", "min-h-"], [...SPACE.slice(0, 20), "0", "full", "min", "max", "fit", "screen", "svh", "dvh"]));
push(SIZING, cross(["max-w-"], MAXW));
push(SIZING, cross(["max-h-"], [...SPACE.slice(0, 24), "none", "full", "screen", "min", "max", "fit", "svh", "dvh"]));

// ── typography ────────────────────────────────────────────────────────────
const TYPO = [];
push(TYPO, cross(["text-"], ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl",
  "5xl", "6xl", "7xl", "8xl", "9xl"]));
push(TYPO, cross(["font-"], ["thin", "extralight", "light", "normal", "medium",
  "semibold", "bold", "extrabold", "black", "sans", "serif", "mono"]));
push(TYPO, cross(["leading-"], ["none", "tight", "snug", "normal", "relaxed",
  "loose", "3", "4", "5", "6", "7", "8", "9", "10"]));
push(TYPO, cross(["tracking-"], ["tighter", "tight", "normal", "wide", "wider", "widest"]));
push(TYPO, cross(["text-"], ["left", "center", "right", "justify", "start", "end",
  "balance", "pretty", "wrap", "nowrap", "ellipsis", "clip"]));
push(TYPO, ["uppercase", "lowercase", "capitalize", "normal-case", "italic",
  "not-italic", "underline", "overline", "line-through", "no-underline",
  "truncate", "antialiased", "subpixel-antialiased", "tabular-nums",
  "slashed-zero", "align-top", "align-middle", "align-bottom", "align-baseline"]);
push(TYPO, cross(["line-clamp-"], ["none", "1", "2", "3", "4", "5", "6"]));
push(TYPO, cross(["whitespace-"], ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]));
push(TYPO, ["break-normal", "break-words", "break-all", "break-keep",
  "list-none", "list-disc", "list-decimal", "list-inside", "list-outside",
  "underline-offset-2", "underline-offset-4", "underline-offset-8",
  "decoration-2", "indent-4", "indent-8"]);
push(TYPO, cross(["columns-"], ["1", "2", "3", "4", "auto"]));

// ── color ─────────────────────────────────────────────────────────────────
const COLOR = [];
// The on-brand palette gets every colour-bearing prefix...
push(COLOR, cross(["bg-", "text-", "border-", "ring-", "fill-", "stroke-",
  "decoration-", "outline-", "divide-", "placeholder-", "accent-",
  "caret-", "shadow-", "from-", "via-", "to-"], [...SEMANTIC, ...BASE_COLORS]));
// ...the raw escape-hatch palettes only the prefixes that actually get reached for.
push(COLOR, cross(["bg-", "text-", "border-", "fill-"], RAW_COLORS));
// Opacity modifiers, semantic palette only (the on-brand vocabulary).
push(COLOR, cross(["bg-", "text-", "border-", "ring-"],
  SEMANTIC.flatMap((c) => OPACITIES.map((o) => `${c}/${o}`))));
push(COLOR, cross(["opacity-"], ["0", "5", "10", "20", "25", "30", "40", "50",
  "60", "70", "75", "80", "90", "95", "100"]));
push(COLOR, ["bg-gradient-to-r", "bg-gradient-to-l", "bg-gradient-to-t",
  "bg-gradient-to-b", "bg-gradient-to-br", "bg-gradient-to-tr", "bg-none",
  "bg-cover", "bg-contain", "bg-center", "bg-no-repeat", "bg-clip-text",
  "bg-clip-border", "bg-fixed"]);

// ── borders & effects ─────────────────────────────────────────────────────
const EFFECTS = [];
push(EFFECTS, cross(["rounded", "rounded-t", "rounded-r", "rounded-b", "rounded-l",
  "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
  ["", "-none", "-sm", "-md", "-lg", "-xl", "-2xl", "-3xl", "-full"]));
push(EFFECTS, cross(["border", "border-t", "border-r", "border-b", "border-l",
  "border-x", "border-y"], ["", "-0", "-2", "-4", "-8"]));
push(EFFECTS, ["border-solid", "border-dashed", "border-dotted", "border-double",
  "border-none", "divide-x", "divide-y", "divide-x-0", "divide-y-0",
  "divide-solid", "divide-dashed"]);
push(EFFECTS, cross(["shadow"], ["", "-sm", "-md", "-lg", "-xl", "-2xl", "-inner", "-none"]));
push(EFFECTS, cross(["ring", "ring-offset"], ["", "-0", "-1", "-2", "-4", "-8"]));
push(EFFECTS, ["ring-inset", "outline-none", "outline", "outline-1", "outline-2",
  "outline-offset-2", "outline-dashed"]);
push(EFFECTS, cross(["blur", "backdrop-blur"], ["", "-none", "-sm", "-md", "-lg", "-xl", "-2xl", "-3xl"]));
push(EFFECTS, cross(["brightness-", "contrast-", "saturate-"], ["0", "50", "75", "90", "100", "110", "125", "150", "200"]));
push(EFFECTS, ["grayscale", "grayscale-0", "invert", "invert-0", "sepia", "sepia-0",
  "mix-blend-multiply", "mix-blend-overlay", "bg-blend-multiply"]);

// ── transform, transition, interactivity ─────────────────────────────────
const MOTION = [];
push(MOTION, cross(["scale-", "scale-x-", "scale-y-"], ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150"]));
push(MOTION, cross(["rotate-", "-rotate-"], ["0", "1", "2", "3", "6", "12", "45", "90", "180"]));
push(MOTION, cross(["translate-x-", "translate-y-", "-translate-x-", "-translate-y-"],
  [...SPACE.slice(0, 22), "full", "1/2"]));
push(MOTION, cross(["skew-x-", "skew-y-"], ["0", "1", "2", "3", "6", "12"]));
push(MOTION, cross(["origin-"], ["center", "top", "top-right", "right", "bottom-right",
  "bottom", "bottom-left", "left", "top-left"]));
push(MOTION, ["transform", "transform-gpu", "transform-none"]);
push(MOTION, cross(["transition"], ["", "-none", "-all", "-colors", "-opacity", "-shadow", "-transform"]));
push(MOTION, cross(["duration-", "delay-"], ["0", "75", "100", "150", "200", "300", "500", "700", "1000"]));
push(MOTION, cross(["ease-"], ["linear", "in", "out", "in-out"]));
push(MOTION, cross(["animate-"], ["none", "spin", "ping", "pulse", "bounce"]));
push(MOTION, cross(["cursor-"], ["auto", "default", "pointer", "wait", "text", "move",
  "help", "not-allowed", "grab", "grabbing"]));
push(MOTION, cross(["select-"], ["none", "text", "all", "auto"]));
push(MOTION, ["pointer-events-none", "pointer-events-auto", "resize", "resize-none",
  "resize-y", "appearance-none", "sr-only", "not-sr-only", "will-change-transform",
  "scroll-smooth", "snap-x", "snap-y", "snap-center", "snap-start", "touch-none"]);

// ── assemble, then add variants where they earn their bytes ───────────────
const BASE = [...LAYOUT, ...SPACING, ...SIZING, ...TYPO, ...COLOR, ...EFFECTS, ...MOTION];

// Responsive: structural utilities only. A design agent varies layout, spacing,
// sizing and type scale across breakpoints; it rarely re-colors at `lg:`.
const RESPONSIVE_SUBJECT = [...LAYOUT, ...SPACING, ...SIZING, ...TYPO];
const RESPONSIVE = cross(["sm:", "md:", "lg:", "xl:"], RESPONSIVE_SUBJECT);

// Interactive states. Restricted to the utilities that genuinely differ per
// state — colour, ring, shadow, opacity, transform — rather than all of COLOR,
// which would multiply the sheet past any reasonable size.
const STATE_SUBJECT = [
  ...cross(["bg-", "text-", "border-", "ring-"], [...SEMANTIC, ...BASE_COLORS]),
  ...cross(["bg-", "text-", "border-"], RAW_COLORS),
  ...cross(["bg-", "text-", "border-"],
    SEMANTIC.flatMap((c) => OPACITIES.map((o) => `${c}/${o}`))),
  ...cross(["opacity-"], ["0", "20", "50", "70", "80", "90", "100"]),
  ...cross(["shadow"], ["", "-sm", "-md", "-lg", "-xl", "-none"]),
  ...cross(["ring", "ring-offset"], ["", "-0", "-1", "-2", "-4"]),
  ...cross(["scale-"], ["95", "100", "105", "110"]),
  ...cross(["translate-y-", "-translate-y-"], ["0", "0.5", "1", "2"]),
  "underline", "no-underline", "cursor-not-allowed", "outline-none",
];
const STATES = cross(["hover:", "focus:", "focus-visible:", "active:",
  "disabled:", "group-hover:", "dark:"], STATE_SUBJECT);

// A few structural state utilities that do come up (hidden on hover, etc.).
const STATE_LAYOUT = cross(["hover:", "focus:", "disabled:", "group-hover:", "dark:"],
  ["hidden", "block", "flex", "underline", "no-underline", "opacity-0",
   "opacity-50", "opacity-100", "pointer-events-none", "cursor-not-allowed"]);

const all = [...new Set([...BASE, ...RESPONSIVE, ...STATES, ...STATE_LAYOUT])].sort();

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "candidates.txt"), all.join("\n") + "\n");
console.error(`candidates: ${all.length}`);
