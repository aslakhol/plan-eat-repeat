import { Button } from "~/components/ui/button";

type Props = {
  dinner: {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  } & {
    tags: {
      value: string;
    }[];
  };
};

export const Dinner = ({ dinner }: Props) => {
  return (
    <>
      <div className="flex flex-col rounded border px-4 py-2">
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
    </>
  );
};
