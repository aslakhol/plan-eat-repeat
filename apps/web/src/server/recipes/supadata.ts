import { z } from "zod";
import { ImportRecipeError } from "@planeatrepeat/shared";

const SUPADATA_API_BASE_URL = "https://api.supadata.ai/v1";
const MAX_SUPADATA_RESPONSE_BYTES = 1_048_576;

const transcriptSchema = z.object({
  content: z.string(),
  lang: z.string().trim().min(1),
  availableLangs: z.array(z.string().trim().min(1)),
});

const transcriptUnavailableSchema = z.object({
  error: z.literal("transcript-unavailable"),
});

const providerErrorSchema = z.object({
  error: z.string().trim().min(1),
});

const transcriptJobSchema = z.object({
  jobId: z.string().trim().min(1),
});

const transcriptJobStateSchema = z.object({
  status: z.enum(["queued", "active", "completed", "failed"]),
});

const completedTranscriptJobSchema = transcriptSchema.extend({
  status: z.literal("completed"),
});

const nestedCompletedTranscriptJobSchema = z.object({
  status: z.literal("completed"),
  result: transcriptSchema,
});

const metadataSchema = z.object({
  platform: z.literal("youtube"),
  type: z.literal("video"),
  id: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type SupadataYouTubeEvidence = {
  title: string;
  description: string;
  transcript: string;
  transcriptLanguage: string | null;
};

type SupadataDiagnostics = {
  info: (message: string, fields: Record<string, unknown>) => void;
  warn: (message: string, fields: Record<string, unknown>) => void;
};

type SupadataYouTubeAdapterOptions = {
  apiKey?: string;
  fetch: typeof fetch;
  diagnostics?: SupadataDiagnostics;
  pollIntervalMs?: number;
};

type SupadataResponse = {
  status: number;
  body: unknown;
  billableRequests: string | null;
};

type SupadataOperation = "metadata" | "transcript" | "transcript-job";
type SupadataFailureCategory =
  | "invalid-response"
  | "job-failed"
  | "provider"
  | "response-too-large"
  | "transport";

class SupadataFailure extends Error {
  constructor(
    readonly category: SupadataFailureCategory,
    readonly operation?: SupadataOperation,
    readonly status?: number,
    readonly providerCode?: string,
    readonly billableRequests?: string | null,
  ) {
    super(category);
    this.name = "SupadataFailure";
  }
}

export const createSupadataYouTubeAdapter = ({
  apiKey,
  fetch: fetchImplementation,
  diagnostics = console,
  pollIntervalMs = 1_000,
}: SupadataYouTubeAdapterOptions) => ({
  acquire: async (
    videoId: string,
    signal: AbortSignal,
  ): Promise<SupadataYouTubeEvidence> => {
    if (!apiKey?.trim()) {
      diagnostics.warn("Supadata YouTube acquisition failed", {
        videoId,
        category: "configuration",
      });
      throw new ImportRecipeError("FETCH_FAILED");
    }

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const transcriptUrl = supadataUrl("transcript", videoUrl);
      transcriptUrl.searchParams.set("mode", "native");
      transcriptUrl.searchParams.set("text", "true");
      const metadataUrl = supadataUrl("metadata", videoUrl);
      const request = async (
        operation: SupadataOperation,
        url: URL,
      ): Promise<SupadataResponse> => {
        let response: Response;
        try {
          response = await fetchImplementation(url, {
            headers: { "x-api-key": apiKey },
            signal,
          });
        } catch (error) {
          if (signal.aborted) throw error;
          throw new SupadataFailure("transport", operation);
        }
        const billableRequests = response.headers.get("x-billable-requests");
        diagnostics.info("Supadata request completed", {
          operation,
          status: response.status,
          billableRequests,
        });
        return {
          status: response.status,
          body: await readJsonBody(
            response,
            operation,
            billableRequests,
          ),
          billableRequests,
        };
      };

      const [transcriptResponse, metadataResponse] = await Promise.all([
        request("transcript", transcriptUrl),
        request("metadata", metadataUrl),
      ]);
      const transcript = await transcriptFromResponse(
        transcriptResponse,
        request,
        signal,
        pollIntervalMs,
      );
      const metadata = metadataFromResponse(metadataResponse, videoId);

      return {
        title: metadata.title ?? "",
        description: metadata.description ?? "",
        transcript: transcript?.content ?? "",
        transcriptLanguage: transcript?.lang ?? null,
      };
    } catch (error) {
      if (signal.aborted) throw error;
      const failure =
        error instanceof SupadataFailure
          ? error
          : new SupadataFailure("invalid-response");
      diagnostics.warn("Supadata YouTube acquisition failed", {
        videoId,
        category: failure.category,
        ...(failure.operation ? { operation: failure.operation } : {}),
        ...(failure.status === undefined ? {} : { status: failure.status }),
        ...(failure.providerCode
          ? { providerCode: failure.providerCode }
          : {}),
        ...(failure.billableRequests === undefined
          ? {}
          : { billableRequests: failure.billableRequests }),
      });
      throw new ImportRecipeError("FETCH_FAILED");
    }
  },
});

const transcriptFromResponse = async (
  response: SupadataResponse,
  request: (operation: SupadataOperation, url: URL) => Promise<SupadataResponse>,
  signal: AbortSignal,
  pollIntervalMs: number,
) => {
  if (response.status === 200) {
    return parseProviderResponse(transcriptSchema, response, "transcript");
  }
  if (response.status === 202) {
    const { jobId } = parseProviderResponse(
      transcriptJobSchema,
      response,
      "transcript",
    );
    return pollTranscriptJob(jobId, request, signal, pollIntervalMs);
  }
  if (response.status === 206) {
    parseProviderResponse(
      transcriptUnavailableSchema,
      response,
      "transcript",
    );
    return null;
  }
  throw providerFailure("transcript", response);
};

const pollTranscriptJob = async (
  jobId: string,
  request: (operation: SupadataOperation, url: URL) => Promise<SupadataResponse>,
  signal: AbortSignal,
  pollIntervalMs: number,
) => {
  const jobUrl = new URL(
    `${SUPADATA_API_BASE_URL}/transcript/${encodeURIComponent(jobId)}`,
  );

  while (true) {
    await waitForPoll(pollIntervalMs, signal);
    const response = await request("transcript-job", jobUrl);
    if (response.status !== 200) {
      throw providerFailure("transcript-job", response);
    }

    const { status } = parseProviderResponse(
      transcriptJobStateSchema,
      response,
      "transcript-job",
    );
    if (status === "queued" || status === "active") continue;
    if (status === "failed") {
      throw new SupadataFailure(
        "job-failed",
        "transcript-job",
        response.status,
        "job-failed",
        response.billableRequests,
      );
    }

    const topLevel = completedTranscriptJobSchema.safeParse(response.body);
    if (topLevel.success) return transcriptSchema.parse(topLevel.data);
    const nested = nestedCompletedTranscriptJobSchema.safeParse(response.body);
    if (nested.success) return nested.data.result;
    throw invalidResponse("transcript-job", response);
  }
};

const waitForPoll = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortReason(signal));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });

const metadataFromResponse = (
  response: SupadataResponse,
  expectedVideoId: string,
) => {
  if (response.status === 200) {
    const metadata = parseProviderResponse(
      metadataSchema,
      response,
      "metadata",
    );
    if (metadata.id !== expectedVideoId) {
      throw invalidResponse("metadata", response);
    }
    return metadata;
  }
  throw providerFailure("metadata", response);
};

const parseProviderResponse = <Output>(
  schema: z.ZodType<Output>,
  response: SupadataResponse,
  operation: SupadataOperation,
): Output => {
  const parsed = schema.safeParse(response.body);
  if (!parsed.success) throw invalidResponse(operation, response);
  return parsed.data;
};

const invalidResponse = (
  operation: SupadataOperation,
  response: SupadataResponse,
) =>
  new SupadataFailure(
    "invalid-response",
    operation,
    response.status,
    undefined,
    response.billableRequests,
  );

const abortReason = (signal: AbortSignal) =>
  signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted", "AbortError");

const providerFailure = (
  operation: SupadataOperation,
  response: SupadataResponse,
) => {
  const providerError = providerErrorSchema.safeParse(response.body);
  return new SupadataFailure(
    "provider",
    operation,
    response.status,
    providerError.success ? providerError.data.error : "invalid-error-response",
    response.billableRequests,
  );
};

const readJsonBody = async (
  response: Response,
  operation: SupadataOperation,
  billableRequests: string | null,
): Promise<unknown> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_SUPADATA_RESPONSE_BYTES
  ) {
    throw new SupadataFailure(
      "response-too-large",
      operation,
      response.status,
      undefined,
      billableRequests,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new SupadataFailure(
      "invalid-response",
      operation,
      response.status,
      undefined,
      billableRequests,
    );
  }

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_SUPADATA_RESPONSE_BYTES) {
        void reader.cancel();
        throw new SupadataFailure(
          "response-too-large",
          operation,
          response.status,
          undefined,
          billableRequests,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SupadataFailure) throw error;
    throw new SupadataFailure(
      "invalid-response",
      operation,
      response.status,
      undefined,
      billableRequests,
    );
  }
};

const supadataUrl = (path: "metadata" | "transcript", videoUrl: string) => {
  const url = new URL(`${SUPADATA_API_BASE_URL}/${path}`);
  url.searchParams.set("url", videoUrl);
  return url;
};
