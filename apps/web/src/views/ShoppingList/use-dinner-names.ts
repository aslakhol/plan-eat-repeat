import { useDinnerSummaries } from "~/hooks/use-dinner-summaries";

// Deleted Dinners drop out because they no longer appear in the summaries.
export function useDinnerNames() {
  const { query } = useDinnerSummaries();
  const names = new Map(
    query.data?.dinners.map((dinner) => [dinner.id, dinner.name]),
  );
  return (dinnerIds: number[]) =>
    dinnerIds.flatMap((id) => names.get(id) ?? []);
}
