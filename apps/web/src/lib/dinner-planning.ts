import {
  addDays,
  format,
  getISOWeek,
  isSameDay,
  startOfDay,
  startOfISOWeek,
} from "date-fns";

export type DinnerPlanningDay = {
  date: Date;
  dateTime: string;
  dayLabel: string;
  fullDate: string;
};

export type DinnerPlanningWeek = {
  start: Date;
  label: string;
  days: DinnerPlanningDay[];
};

const formatFullDate = (date: Date) => format(date, "EEEE, LLLL do, y");

export const formatWeekOverviewDayLabel = (date: Date, today: Date) =>
  `${format(date, "EEE do")}${isSameDay(date, today) ? " · Tonight" : ""}`;

export const buildDinnerPlanningWeek = (date: Date): DinnerPlanningWeek => {
  const start = startOfISOWeek(startOfDay(date));

  return {
    start,
    label: `Week ${getISOWeek(start)}, ${format(start, "LLLL y")}`,
    days: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      return {
        date: day,
        dateTime: format(day, "yyyy-MM-dd"),
        dayLabel: format(day, "EEE do"),
        fullDate: formatFullDate(day),
      };
    }),
  };
};

export const formatDinnerPlanningConfirmation = (
  dinnerName: string,
  date: Date,
) => `${dinnerName} → ${formatFullDate(date)}`;
