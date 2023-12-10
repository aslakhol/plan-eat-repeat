import { type Dinner } from "@prisma/client";

export const getFirstAvailableDay = (
  plannedDinners: Dinner[],
): number | undefined => {
  const plannedForDays = plannedDinners.map((dinner) => dinner.plannedForDay!);

  const firstAvailableDay = [0, 1, 2, 3, 4, 5, 6].find(
    (day) => !plannedForDays.includes(day),
  );

  return firstAvailableDay;
};

export const getWeekPlan = (dinners?: Dinner[]) => {
  const weekPlan = new Array<Dinner | undefined>(7);

  dinners?.forEach((dinner) => {
    if (dinner.plannedForDay !== null) {
      weekPlan[dinner.plannedForDay] = dinner;
    }
  });

  return weekPlan;
};
