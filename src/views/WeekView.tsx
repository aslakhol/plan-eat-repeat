import { BottomNav } from "./BottomNav";
import { WeekPlan } from "./WeekPlan/WeekPlan";

export const WeekView = () => {
  return (
    <div className="grid h-screen">
      <WeekPlan />

      <BottomNav />
    </div>
  );
};
