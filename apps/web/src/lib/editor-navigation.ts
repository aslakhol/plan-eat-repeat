export type EditorOrigin = "cookbook" | "week";
export type EditorMode = "manual";

export type EditorNavigation = {
  origin: EditorOrigin;
  date?: string;
  name?: string;
  mode?: EditorMode;
};

type QueryValue = string | string[] | undefined;
type EditorQuery = Record<string, QueryValue>;

export type EditorHref = {
  pathname: string;
  query: Record<string, string>;
};

const singleValue = (value: QueryValue) =>
  typeof value === "string" ? value : undefined;

export const isPlanSlotDate = (value: string | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export const planSlotDateFromString = (value: string) => {
  const [year, month, day] = value.split("-");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("Invalid Plan Slot date");
  }
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const parseEditorNavigation = (query: EditorQuery): EditorNavigation => {
  const originValue = singleValue(query.origin);
  const origin: EditorOrigin = originValue === "week" ? "week" : "cookbook";
  const dateValue = singleValue(query.date);
  const nameValue = singleValue(query.name)?.trim();
  const modeValue = singleValue(query.mode);

  return {
    origin,
    ...(origin === "week" && isPlanSlotDate(dateValue)
      ? { date: dateValue }
      : {}),
    ...(nameValue ? { name: nameValue } : {}),
    ...(modeValue === "manual" ? { mode: modeValue } : {}),
  };
};

export const buildCreateDinnerEditorHref = (
  navigation: EditorNavigation,
): EditorHref => ({
  pathname: "/dinners/new",
  query: {
    origin: navigation.origin,
    ...(navigation.date ? { date: navigation.date } : {}),
    ...(navigation.mode ? { mode: navigation.mode } : {}),
    ...(navigation.name?.trim() ? { name: navigation.name.trim() } : {}),
  },
});

export const buildDinnerEditorHref = (
  dinnerId: number,
  navigation: Pick<EditorNavigation, "origin" | "date">,
): EditorHref => ({
  pathname: `/dinners/${dinnerId}`,
  query: {
    edit: "1",
    origin: navigation.origin,
    ...(navigation.date ? { date: navigation.date } : {}),
  },
});

export const editorCancelHref = (navigation: EditorNavigation) =>
  navigation.origin === "week" ? "/" : "/dinners";

export const editorSaveHref = (
  dinnerId: number,
  navigation: EditorNavigation,
): EditorHref | string =>
  navigation.origin === "week" && navigation.date
    ? { pathname: "/", query: { date: navigation.date } }
    : `/dinners/${dinnerId}`;
