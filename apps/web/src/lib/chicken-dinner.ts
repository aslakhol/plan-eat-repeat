const CHICKEN_WORD =
  /(?<![\p{L}\p{N}_])(?:chicken|kylling)(?![\p{L}\p{N}_])/iu;

export const isChickenDinner = (title: string, tags: readonly string[] = []) =>
  CHICKEN_WORD.test(title) || tags.some((tag) => CHICKEN_WORD.test(tag));

export const saveDinnerLabel = (title: string, tags: readonly string[] = []) =>
  isChickenDinner(title, tags)
    ? "Winner, winner, chicken dinner."
    : "Save dinner";
