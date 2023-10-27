import { Button } from "~/components/ui/button";

type Props = {};

export const Dinner = ({}: Props) => {
  return (
    <>
      <div className="flex flex-col rounded border px-4 py-2">
        <h3 className="font-semibold">Dinner 1</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            className="rounded bg-blue-100 px-2 py-1 text-blue-800 active:bg-blue-200"
            variant="ghost"
          >
            Tag1
          </Button>
          <Button
            className="rounded bg-red-100 px-2 py-1 text-red-800 active:bg-red-200"
            variant="ghost"
          >
            Tag2
          </Button>
          <Button
            className="rounded bg-green-100 px-2 py-1 text-green-800 active:bg-green-200"
            variant="ghost"
          >
            Tag3
          </Button>
          <Button
            className="rounded bg-yellow-100 px-2 py-1 text-yellow-800 active:bg-yellow-200"
            variant="ghost"
          >
            Tag4
          </Button>
          <Button
            className="rounded bg-purple-100 px-2 py-1 text-purple-800 active:bg-purple-200"
            variant="ghost"
          >
            Tag5
          </Button>
          <Button
            className="rounded bg-pink-100 px-2 py-1 text-pink-800 active:bg-pink-200"
            variant="ghost"
          >
            Tag6
          </Button>
        </div>
      </div>
    </>
  );
};
