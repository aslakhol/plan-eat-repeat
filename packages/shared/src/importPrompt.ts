import { z } from "zod";

export const IMPORT_PROMPT_MAX_LENGTH = 20_000;
export const importPromptSchema = z
  .string()
  .max(IMPORT_PROMPT_MAX_LENGTH, "Prompt must be at most 20,000 characters");
