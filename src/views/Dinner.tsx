import { cn } from "../lib/utils";
import { type DinnerWithTags } from "../utils/types";

type Props = {
  dinner: DinnerWithTags;
  onClick: (dinner: DinnerWithTags) => void;
  selected: boolean;
};

export const Dinner = ({ dinner, onClick, selected }: Props) => {
  const toggleMutation = api.dinner.toggle.useMutation();
  const utils = api.useUtils();

  const handleClick = () => {
    onClick(dinner);
    toggleMutation.mutate(
      { dinnerId: dinner.id },
      {
        onSettled: (data) => {
          void utils.dinner.weekPlan.invalidate();
        },
      },
    );
  };

  return (
    <div
      className={cn(
        "hover:bg-accent/50 hover:text-accent-foreground flex flex-col rounded border px-4 py-2",
        selected && "ring-2",
      )}
      onClick={handleClick}
    >
      <h3 className="font-semibold">{dinner.name}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {dinner.tags.map((tag) => {
          return (
            <div
              key={tag.value}
              className="rounded bg-green-100 px-2 py-1 text-green-800 active:bg-green-200"
            >
              {tag.value}
            </div>
          );
        })}
      </div>
    </div>
  );
};
