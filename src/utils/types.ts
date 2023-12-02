import { type Tag, type Dinner } from "@prisma/client";

export type DinnerWithTags = Dinner & { tags: Tag[] };

export type Day = {
  day: string;
  number: number;
  plannedDinner?: Dinner;
};
