import type {
  AiImportInferenceState,
  AiImportSource,
  PrismaClient,
} from "@planeatrepeat/db";
import type { LanguageModelUsage } from "ai";

import { estimateAiImportCostUsd } from "./ai-import-inference";
import { importRecipeFromText, type InferenceObserver } from "./importRecipe";

export type { InferenceObserver };

type AiImportAttribution = {
  householdId: string;
  membershipId: number;
  householdAttributionKey: string;
  membershipAttributionKey: string;
};

type CreateAiImportAttemptInput = AiImportAttribution & {
  source: AiImportSource;
  startedAt: Date;
};

export type AiImportAttemptChanges = {
  finishedAt?: Date;
  inferenceStartedAt?: Date;
  inferenceState?: AiImportInferenceState;
  estimatedAiImportCostUsd?: number | null;
};

export type AiImportTrackingPersistence = {
  findAttribution(input: {
    householdId: string;
    userId: string;
  }): Promise<AiImportAttribution>;
  createAttempt(input: CreateAiImportAttemptInput): Promise<string>;
  loadInstructions(householdId: string): Promise<string | null>;
  updateAttempt(
    attemptId: string,
    changes: AiImportAttemptChanges,
  ): Promise<void>;
};

type TrackedRecipeImportInput = {
  source: { type: "TEXT"; text: string };
  householdId: string;
  userId: string;
  signal?: AbortSignal;
};

type TrackedRecipeImporterDependencies<Result> = {
  persistence: AiImportTrackingPersistence;
  extractFromText(input: {
    text: string;
    instructions: string | null;
    signal?: AbortSignal;
    observer: InferenceObserver;
  }): Promise<Result>;
  now?: () => Date;
  warn?: (operation: string) => void;
};

export const createTrackedRecipeImporter = <Result>({
  persistence,
  extractFromText,
  now = () => new Date(),
  warn = (operation) => console.warn(`[AI Import Spend] ${operation} failed`),
}: TrackedRecipeImporterDependencies<Result>) => {
  return async (input: TrackedRecipeImportInput): Promise<Result> => {
    let attemptId: string | null = null;
    let inferenceState: AiImportInferenceState = "NOT_INCURRED";
    let estimatedAiImportCostUsd: number | null = null;

    let attribution: AiImportAttribution | null = null;
    try {
      attribution = await persistence.findAttribution({
        householdId: input.householdId,
        userId: input.userId,
      });
    } catch {
      warn("find-attribution");
    }

    if (attribution) {
      try {
        attemptId = await persistence.createAttempt({
          ...attribution,
          source: input.source.type,
          startedAt: now(),
        });
      } catch {
        warn("create-attempt");
      }
    }

    const updateAttempt = async (
      operation: string,
      changes: AiImportAttemptChanges,
    ) => {
      if (!attemptId) return;
      try {
        await persistence.updateAttempt(attemptId, changes);
      } catch {
        warn(operation);
      }
    };

    const observer: InferenceObserver = {
      onInferenceStart: async () => {
        inferenceState = "UNKNOWN";
        await updateAttempt("start-inference", {
          inferenceStartedAt: now(),
        });
      },
      onInferenceUsage: async (model, usage) => {
        estimatedAiImportCostUsd = estimateAiImportCostUsd(model, usage);
        inferenceState =
          estimatedAiImportCostUsd === null ? "UNKNOWN" : "ESTIMATED";
        await updateAttempt("capture-usage", {
          inferenceState,
          estimatedAiImportCostUsd,
        });
      },
    };

    try {
      const instructions = await persistence.loadInstructions(
        input.householdId,
      );
      return await extractFromText({
        text: input.source.text,
        instructions,
        signal: input.signal,
        observer,
      });
    } finally {
      await updateAttempt("finish-attempt", {
        finishedAt: now(),
        inferenceState,
        estimatedAiImportCostUsd,
      });
    }
  };
};

const prismaAiImportTrackingPersistence = (
  db: PrismaClient,
): AiImportTrackingPersistence => ({
  async findAttribution({ householdId, userId }) {
    const membership = await db.membership.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true,
        householdId: true,
        aiImportSpendAttributionKey: true,
        household: {
          select: { aiImportSpendAttributionKey: true },
        },
      },
    });
    if (membership.householdId !== householdId) {
      throw new Error("AI Import Attempt attribution does not match Household");
    }
    return {
      householdId,
      membershipId: membership.id,
      householdAttributionKey: membership.household.aiImportSpendAttributionKey,
      membershipAttributionKey: membership.aiImportSpendAttributionKey,
    };
  },
  async createAttempt(input) {
    const attempt = await db.aiImportAttempt.create({ data: input });
    return attempt.id;
  },
  async loadInstructions(householdId) {
    const household = await db.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { importInstructions: true },
    });
    return household.importInstructions;
  },
  async updateAttempt(attemptId, changes) {
    await db.aiImportAttempt.update({
      where: { id: attemptId },
      data: changes,
    });
  },
});

export const importTrackedRecipe = (
  db: PrismaClient,
  input: TrackedRecipeImportInput,
) =>
  createTrackedRecipeImporter({
    persistence: prismaAiImportTrackingPersistence(db),
    extractFromText: ({ text, instructions, signal, observer }) =>
      importRecipeFromText(text, instructions, signal, observer),
  })(input);
