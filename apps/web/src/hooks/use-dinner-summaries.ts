import { addDays, startOfDay, startOfISOWeek } from "date-fns";
import { useEffect, useState } from "react";

import { api } from "~/utils/api";

const localCalendarBoundaries = () => {
  const today = startOfDay(new Date());
  const currentWeekStart = startOfISOWeek(today);

  return {
    today,
    currentWeekStart,
    currentWeekEnd: addDays(currentWeekStart, 7),
  };
};

export const useDinnerSummaries = () => {
  const [calendar, setCalendar] = useState(localCalendarBoundaries);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const refreshCalendar = () => {
      const nextCalendar = localCalendarBoundaries();
      setCalendar((currentCalendar) =>
        currentCalendar.today.getTime() === nextCalendar.today.getTime()
          ? currentCalendar
          : nextCalendar,
      );
    };

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextLocalDay = addDays(startOfDay(now), 1);
      midnightTimer = setTimeout(() => {
        refreshCalendar();
        scheduleMidnightRefresh();
      }, nextLocalDay.getTime() - now.getTime() + 1_000);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCalendar();
    };

    scheduleMidnightRefresh();
    window.addEventListener("focus", refreshCalendar);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      clearTimeout(midnightTimer);
      window.removeEventListener("focus", refreshCalendar);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return {
    today: calendar.today,
    query: api.dinner.summaries.useQuery(calendar),
  };
};
