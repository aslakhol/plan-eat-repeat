const publishedDinnerUpsells = [
  "Never wonder what's for dinner.",
  "All your recipes in one place.",
  "Stop screenshotting recipes.",
  "All your meal planning in five minutes.",
  "Rescue your recipes from the group chat.",
  "Fewer trips to the shop at half five.",
  "Fewer hungry trips to the shop.",
  "No more “whats for dinner”",
  "Everyone knows whats for dinner.",
] as const;

export const pickPublishedDinnerUpsell = () =>
  publishedDinnerUpsells[
    Math.floor(Math.random() * publishedDinnerUpsells.length)
  ]!;
