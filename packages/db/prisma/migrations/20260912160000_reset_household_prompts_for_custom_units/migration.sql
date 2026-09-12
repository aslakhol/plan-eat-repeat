-- One-time rollout reset: saved prompts may still discard custom units.
-- Prisma records this migration; prompts saved after rollout remain untouched.
UPDATE "Household" SET "importInstructions" = NULL;
