import { addDays, startOfDay } from "date-fns";
import { useEffect, useState } from "react";

export function useToday() {
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      const day = startOfDay(now);
      setToday((previous) =>
        previous.getTime() === day.getTime() ? previous : day,
      );
      timer = setTimeout(update, addDays(day, 1).getTime() - now.getTime());
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}
