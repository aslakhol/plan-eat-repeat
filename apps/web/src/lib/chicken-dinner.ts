const CHICKEN_WORD = /(?<![\p{L}\p{N}_])chicken(?![\p{L}\p{N}_])/iu;

export const isChickenDinnerTitle = (title: string) => CHICKEN_WORD.test(title);

export const saveDinnerLabel = (title: string) =>
  isChickenDinnerTitle(title)
    ? "Winner, winner, chicken dinner."
    : "Save dinner";
