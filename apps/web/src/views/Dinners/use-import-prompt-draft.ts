import { useEffect, useState } from "react";
import { z } from "zod";
import { importPromptSchema } from "@planeatrepeat/shared";

const draftSchema = z.object({
  prompt: importPromptSchema,
  rememberPrompt: z.boolean(),
});

export function useImportPromptDraft(
  storageKey: string,
  householdPrompt: string,
) {
  const [draft, setDraft] = useState(() => {
    try {
      const saved = draftSchema.safeParse(
        JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      );
      if (saved.success) return saved.data;
    } catch {
      // An unavailable store or unreadable draft must not prevent importing.
    }
    return { prompt: householdPrompt, rememberPrompt: false };
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // The open import still works when browser storage is unavailable.
    }
  }, [storageKey, draft]);

  return { draft, setDraft };
}
