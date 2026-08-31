import type {
  AiImportInferenceState,
  AiImportSource,
  PrismaClient,
} from "@planeatrepeat/db";
import {
  ImportRecipeError,
  isInstagramMediaUrl,
  youtubeVideoIdFromUrl,
} from "@planeatrepeat/shared";

import { estimateAiImportCostUsd } from "./ai-import-inference";
import {
  importRecipeFromImages,
  importRecipeFromText,
  importRecipeFromUrl,
  type InferenceObserver,
  type RecipeImportImage,
} from "./importRecipe";
import type { SupadataSpendObserver } from "./supadata-spend";

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
  providerId?: string;
  requestedModelId?: string;
  responseModelId?: string;
  totalInputTokens?: number | null;
  totalOutputTokens?: number | null;
  estimatedAiImportCostUsd?: number | null;
};

type AiImportModelIdentity = {
  providerId: string;
  requestedModelId: string;
};

type AiImportInferenceUsage = {
  responseModelId: string;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
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
  startSupadataOperation(attemptId: string): Promise<void>;
  settleSupadataOperation(attemptId: string, credits: number): Promise<void>;
};

export type TrackedRecipeImportRequest =
  | { type: "TEXT"; text: string }
  | {
      type: "PHOTO";
      images: ReadonlyArray<RecipeImportImage>;
    }
  | { type: "URL"; url: string };

type TrackedRecipeImportInput = {
  request: TrackedRecipeImportRequest;
  householdId: string;
  userId: string;
  signal?: AbortSignal;
};

const DIRECT_IMPORT_SOURCES = {
  TEXT: "TEXT",
  PHOTO: "PHOTO",
} as const satisfies Record<"TEXT" | "PHOTO", AiImportSource>;

export const classifyAiImportSource = (
  request: TrackedRecipeImportRequest,
): AiImportSource => {
  if (request.type !== "URL") return DIRECT_IMPORT_SOURCES[request.type];
  if (youtubeVideoIdFromUrl(request.url)) return "YOUTUBE";
  return isInstagramMediaUrl(request.url) ? "INSTAGRAM" : "LINK";
};

type TrackedRecipeImporterDependencies<Result> = {
  persistence: AiImportTrackingPersistence;
  executeImport: (input: {
    request: TrackedRecipeImportRequest;
    instructions: string | null;
    signal?: AbortSignal;
    observer: InferenceObserver;
    supadataObserver: SupadataSpendObserver;
  }) => Promise<Result>;
  now?: () => Date;
  timeoutMs?: number;
  warn?: (operation: string) => void;
};

const AI_IMPORT_TIMEOUT_MS = 150_000;

export const createTrackedRecipeImporter = <Result>({
  persistence,
  executeImport,
  now = () => new Date(),
  timeoutMs = AI_IMPORT_TIMEOUT_MS,
  warn = (operation) => console.warn(`[AI Import Spend] ${operation} failed`),
}: TrackedRecipeImporterDependencies<Result>) => {
  return async (input: TrackedRecipeImportInput): Promise<Result> => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = input.signal
      ? AbortSignal.any([input.signal, timeoutSignal])
      : timeoutSignal;
    let attemptId: string | null = null;
    let inferenceState: AiImportInferenceState = "NOT_INCURRED";
    let estimatedAiImportCostUsd: number | null = null;
    let modelIdentity: AiImportModelIdentity | null = null;
    let inferenceUsage: AiImportInferenceUsage | null = null;

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
          source: classifyAiImportSource(input.request),
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
      onInferenceStart: async ({ providerId, requestedModelId }) => {
        inferenceState = "UNKNOWN";
        modelIdentity = { providerId, requestedModelId };
        await updateAttempt("start-inference", {
          inferenceStartedAt: now(),
          ...modelIdentity,
        });
      },
      onInferenceUsage: async ({
        providerId,
        requestedModelId,
        responseModelId,
        usage,
      }) => {
        modelIdentity = { providerId, requestedModelId };
        inferenceUsage = {
          responseModelId,
          totalInputTokens: usage.inputTokens ?? null,
          totalOutputTokens: usage.outputTokens ?? null,
        };
        estimatedAiImportCostUsd = estimateAiImportCostUsd(
          requestedModelId,
          usage,
        );
        inferenceState =
          estimatedAiImportCostUsd === null ? "UNKNOWN" : "ESTIMATED";
        await updateAttempt("capture-usage", {
          inferenceState,
          ...modelIdentity,
          ...inferenceUsage,
          estimatedAiImportCostUsd,
        });
      },
    };
    const supadataObserver: SupadataSpendObserver = {
      onOperationStarted: async () => {
        if (!attemptId) return;
        try {
          await persistence.startSupadataOperation(attemptId);
        } catch {
          warn("start-supadata-operation");
        }
      },
      onCreditsKnown: async (credits) => {
        if (!attemptId) return;
        try {
          await persistence.settleSupadataOperation(attemptId, credits);
        } catch {
          warn("settle-supadata-operation");
        }
      },
    };

    try {
      const instructions = await persistence.loadInstructions(
        input.householdId,
      );
      return await executeImport({
        request: input.request,
        instructions,
        signal,
        observer,
        supadataObserver,
      });
    } catch (error) {
      if (timeoutSignal.aborted && signal.reason === timeoutSignal.reason) {
        throw new ImportRecipeError("IMPORT_TIMED_OUT");
      }
      throw error;
    } finally {
      await updateAttempt("finish-attempt", {
        finishedAt: now(),
        inferenceState,
        ...(modelIdentity ?? {}),
        ...(inferenceUsage ?? {}),
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
  async startSupadataOperation(attemptId) {
    await db.aiImportAttempt.update({
      where: { id: attemptId },
      data: {
        supadataOperationsStarted: { increment: 1 },
        supadataUnknownOperationCount: { increment: 1 },
      },
    });
  },
  async settleSupadataOperation(attemptId, credits) {
    await db.aiImportAttempt.updateMany({
      where: {
        id: attemptId,
        supadataUnknownOperationCount: { gt: 0 },
      },
      data: {
        supadataCredits: { increment: credits },
        supadataUnknownOperationCount: { decrement: 1 },
      },
    });
  },
});

export const importTrackedRecipe = (
  db: PrismaClient,
  input: TrackedRecipeImportInput,
) =>
  createTrackedRecipeImporter({
    persistence: prismaAiImportTrackingPersistence(db),
    executeImport: ({
      request,
      instructions,
      signal,
      observer,
      supadataObserver,
    }) => {
      switch (request.type) {
        case "TEXT":
          return importRecipeFromText(request.text, {
            instructions,
            signal,
            inferenceObserver: observer,
          });
        case "PHOTO":
          return importRecipeFromImages(request.images, {
            instructions,
            signal,
            inferenceObserver: observer,
          });
        case "URL":
          return importRecipeFromUrl(request.url, {
            instructions,
            signal,
            inferenceObserver: observer,
            supadataObserver,
          });
      }
    },
  })(input);
