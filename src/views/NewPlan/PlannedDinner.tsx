import { Button } from "../../components/ui/button";
import { type DinnerWithTags } from "../../utils/types";

type Props = {
  dinner: DinnerWithTags;
};

export const PlannedDinner = ({ dinner }: Props) => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">{dinner.name}</h1>
      {dinner.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dinner.tags.map((tag) => (
            <div
              className="rounded border border-green-100 bg-green-100 px-2 py-1 text-green-800"
              key={tag.value}
            >
              {tag.value}
            </div>
          ))}
        </div>
      )}
      {dinner.link && (
        <a
          className="line-clamp-1 max-w-md text-sm text-blue-500 underline"
          href={dinner.link}
          target="_blank"
        >
          {dinner.link}
        </a>
      )}
      {dinner.notes && (
        <div className="min-h-[100px]">
          {dinner.notes.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <div className="flex w-full gap-2">
        <Button variant={"outline"}>Change plan</Button>
        <Button variant={"outline"}>Clear day</Button>
        <Button variant={"outline"}>Edit dinner</Button>
      </div>
    </div>
  );
};
