export const creditsFromSupadataBillingHeader = (value: string | null) => {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const credits = Number(value);
  return Number.isSafeInteger(credits) ? credits : null;
};

export type SupadataSpendObserver = {
  onOperationStarted(): Promise<void> | void;
  onCreditsKnown(credits: number): Promise<void> | void;
};
