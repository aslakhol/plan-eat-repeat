import { z } from "zod";
import { asOptionalStringWithoutEmpty } from "./zod";
import { type Tag, type Dinner } from "../../generated/prisma/client";

export type DinnerWithTags = Dinner & { tags: Tag[] };

export const dinnerFormSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()),
  newTag: asOptionalStringWithoutEmpty(z.string().max(20).min(1)),
  link: asOptionalStringWithoutEmpty(z.string().url()),
  notes: asOptionalStringWithoutEmpty(z.string()),
});
