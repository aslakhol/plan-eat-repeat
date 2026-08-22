import { z } from "zod";

import { validUrlOrNull } from "./recipeImport";

const ordinaryDomainName = (hostname: string) => {
  const labels = hostname.split(".");
  const topLevelDomain = labels.at(-1);

  return (
    labels.length > 1 &&
    topLevelDomain !== undefined &&
    /[a-z]/i.test(topLevelDomain) &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  );
};

const inferredHttpsDinnerLink = (value: string) => {
  if (!/^[\p{L}\p{N}]/u.test(value)) return null;

  const normalized = validUrlOrNull(`https://${value}`);
  if (!normalized) return null;

  const url = new URL(normalized);
  if (url.username || url.password || !ordinaryDomainName(url.hostname)) {
    return null;
  }

  return normalized;
};

export const normalizeDinnerLinkInput = (value: string) =>
  validUrlOrNull(value) ?? inferredHttpsDinnerLink(value.trim());

export const dinnerLinkSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value, context) => {
    if (value === null || value === undefined) return value;
    if (value.trim() === "") return null;

    const normalized = validUrlOrNull(value);
    if (normalized) return normalized;

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid link",
    });
    return z.NEVER;
  });
