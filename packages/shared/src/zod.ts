import { z } from "zod";

const emptyStringToUndefined = z.literal("").transform(() => undefined);

export function asOptionalStringWithoutEmpty<T extends z.ZodString>(schema: T) {
  return schema.optional().or(emptyStringToUndefined);
}
