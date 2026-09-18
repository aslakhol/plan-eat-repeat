import { z } from "zod";

export const odaProductPreferenceSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(500),
  description: z.string().max(2000),
});

export type OdaProductPreference = z.infer<typeof odaProductPreferenceSchema>;
