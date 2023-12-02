import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

type Props = {
  day?: string;
  dayNumber?: number;
};

export const PlanDayDialog = ({ day, dayNumber }: Props) => {
  return (
    <DialogContent className="h-full">
      <DialogHeader>
        <DialogTitle>
          {day} {dayNumber}
        </DialogTitle>
      </DialogHeader>
      <div>{/* <DialogWeek selectedDinner={dinner} /> */}</div>
    </DialogContent>
  );
};
