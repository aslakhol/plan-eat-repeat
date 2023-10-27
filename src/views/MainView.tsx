import { Button } from "../components/ui/button";

export const MainView = () => {
  return (
    <div className="grid h-screen grid-cols-2">
      <div className="flex flex-col justify-between space-y-8 overflow-y-auto p-6">
        <div>
          <div className="mb-6 flex justify-between">
            <h2 className="text-xl font-bold">Dinners</h2>
          </div>
          <div className="space-y-4">
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
            <div className="flex flex-col rounded border px-4 py-2">
              <h3 className="font-semibold">Dinner 2</h3>
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
            <div className="mt-12 flex justify-center">
              <Button
                className="bg-white p-4 text-gray-500 hover:bg-gray-200"
                variant="outline"
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
      <div className="flex flex-col items-end justify-start bg-gray-50 p-6 dark:bg-gray-900">
        <h2 className="mb-8 text-right text-xl font-bold">Week Plan</h2>
        <div className="w-full space-y-4 text-right">
          <div className="flex flex-col rounded border px-4 py-2">
            <h3 className="font-semibold">Monday</h3>
            <p className="mt-2">No dinner selected</p>
          </div>
          <div className="flex flex-col rounded border px-4 py-2">
            <h3 className="font-semibold">Tuesday</h3>
            <p className="mt-2">No dinner selected</p>
          </div>
        </div>
      </div>
    </div>
  );
};
