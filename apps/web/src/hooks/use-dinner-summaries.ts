import { addDays, startOfDay, startOfISOWeek } from "date-fns";
import { useState } from "react";

import { api } from "~/utils/api";

export const useDinnerSummaries = () => {
  const [calendar] = useState(() => {
    const today = startOfDay(new Date());
    const currentWeekStart = startOfISOWeek(today);

    return {
      today,
      currentWeekStart,
      currentWeekEnd: addDays(currentWeekStart, 7),
    };
  });

  return {
    today: calendar.today,
    query: api.dinner.summaries.useQuery(calendar),
  };
};
