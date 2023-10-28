type Props = {};

export const WeekPlan = ({}: Props) => {
  return (
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
  );
};
