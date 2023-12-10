import { type Dinner } from "@prisma/client";

export const getWeekPlan = (dinners?: Dinner[]) => {
  const weekPlan = new Array<Dinner | undefined>(7);

  dinners?.forEach((dinner) => {
    if (dinner.plannedForDay !== null) {
      weekPlan[dinner.plannedForDay] = dinner;
    }
  });

  return weekPlan;
};
