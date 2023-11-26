import { Button } from "~/components/ui/button";
import { Dinner } from "./Dinner";
import { type DinnerWithTags } from "../utils/types";
import { AddDinner } from "./AddDinner";
import { useState } from "react";
import { cn } from "../lib/utils";

type Props = {
  dinners: DinnerWithTags[];
};

export const Dinners = ({ dinners }: Props) => {
  const [isAddDinnerOpen, setOpenAddDinner] = useState(false);

  function openAddDinner() {
    setOpenAddDinner(true);
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-col justify-between space-y-8 overflow-y-auto  p-6",
        )}
      >
        <div>
          <div className="mb-6 flex justify-between">
            <h2 className="text-xl font-bold">Dinners</h2>
          </div>
          <div className="space-y-4">
            {dinners.map((dinner) => {
              return <Dinner key={dinner.id} dinner={dinner} />;
            })}
            <div className="mt-12 flex justify-center">
              {isAddDinnerOpen ? (
                <AddDinner setOpenAddDinner={setOpenAddDinner} />
              ) : (
                <Button
                  className="bg-white p-4 text-gray-500 hover:bg-gray-200"
                  variant="outline"
                  onClick={openAddDinner}
                >
                  <svg
                    className=" h-5 w-5"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col space-y-4">
          <div className="mb-4">
            <input
              aria-label="Search dinners"
              className="w-full rounded border p-2"
              placeholder="Search dinners"
              type="search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
              className="rounded border-purple-400 bg-purple-200 px-2 py-1 text-purple-800 active:bg-purple-300"
              variant="outline"
            >
              Tag5
            </Button>
            <Button
              className="rounded border-pink-400 bg-pink-200 px-2 py-1 text-pink-800 active:bg-pink-300"
              variant="outline"
            >
              Tag6
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
