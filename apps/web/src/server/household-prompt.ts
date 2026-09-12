import { importPromptSchema } from "@planeatrepeat/shared";
import { getSystemDefaultPrompt } from "./ai/import-prompt";

export const householdPromptSchema = importPromptSchema.transform((prompt) =>
  !prompt.trim() || prompt === getSystemDefaultPrompt() ? null : prompt,
);
