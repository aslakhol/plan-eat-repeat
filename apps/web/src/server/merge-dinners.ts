type MergePlanSlot = {
  id: number;
  dinnerId: number;
  date: Date;
};

type PlanDinnerMergeInput = {
  keptDinnerId: number;
  discardedDinnerId: number;
  planSlots: readonly MergePlanSlot[];
};

type PlanDinnerMergeChanges = {
  reassignPlanSlotIds: number[];
  deletePlanSlotIds: number[];
};

export const planDinnerMerge = ({
  keptDinnerId,
  discardedDinnerId,
  planSlots,
}: PlanDinnerMergeInput): PlanDinnerMergeChanges => {
  const planSlotsByDate = new Map<number, MergePlanSlot[]>();

  for (const planSlot of planSlots) {
    if (
      planSlot.dinnerId !== keptDinnerId &&
      planSlot.dinnerId !== discardedDinnerId
    ) {
      continue;
    }

    const timestamp = planSlot.date.getTime();
    const matchingPlanSlots = planSlotsByDate.get(timestamp) ?? [];
    matchingPlanSlots.push(planSlot);
    planSlotsByDate.set(timestamp, matchingPlanSlots);
  }

  const reassignPlanSlotIds: number[] = [];
  const deletePlanSlotIds: number[] = [];

  for (const matchingPlanSlots of planSlotsByDate.values()) {
    const keptPlanSlots = matchingPlanSlots
      .filter((planSlot) => planSlot.dinnerId === keptDinnerId)
      .sort((left, right) => left.id - right.id);
    const discardedPlanSlots = matchingPlanSlots
      .filter((planSlot) => planSlot.dinnerId === discardedDinnerId)
      .sort((left, right) => left.id - right.id);

    if (discardedPlanSlots.length === 0) continue;

    if (keptPlanSlots.length > 0) {
      deletePlanSlotIds.push(
        ...keptPlanSlots.slice(1).map((planSlot) => planSlot.id),
        ...discardedPlanSlots.map((planSlot) => planSlot.id),
      );
      continue;
    }

    const [planSlotToReassign, ...redundantPlanSlots] = discardedPlanSlots;
    if (planSlotToReassign) {
      reassignPlanSlotIds.push(planSlotToReassign.id);
    }
    deletePlanSlotIds.push(
      ...redundantPlanSlots.map((planSlot) => planSlot.id),
    );
  }

  return {
    reassignPlanSlotIds: reassignPlanSlotIds.sort(
      (left, right) => left - right,
    ),
    deletePlanSlotIds: deletePlanSlotIds.sort((left, right) => left - right),
  };
};
