import { z } from "zod";
import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  creditsFromSupadataBillingHeader,
  type SupadataSpendObserver,
} from "./supadata-spend";

const SUPADATA_WEB_SCRAPE_URL = "https://api.supadata.ai/v1/web/scrape";
const MAX_SUPADATA_RESPONSE_BYTES = 1_048_576;

const webScrapeSchema = z.object({
  url: z.string(),
  content: z.string(),
  countCharacters: z.number(),
  urls: z.array(z.string()),
});

const providerErrorSchema = z.object({
  error: z.string().trim().min(1),
});

type SupadataDiagnostics = {
  info: (message: string, fields: Record<string, unknown>) => void;
  warn: (message: string, fields: Record<string, unknown>) => void;
};

type SupadataWebAdapterOptions = {
  apiKey?: string;
  fetch: typeof fetch;
  diagnostics?: SupadataDiagnostics;
  spendObserver?: SupadataSpendObserver;
};

type SupadataFailureCategory =
  | "invalid-response"
  | "provider"
  | "response-too-large"
  | "transport";

class SupadataWebFailure extends Error {
  constructor(
    readonly category: SupadataFailureCategory,
    readonly status?: number,
    readonly providerCode?: string,
    readonly billableRequests?: string | null,
  ) {
    super(category);
    this.name = "SupadataWebFailure";
  }
}

export const createSupadataWebAdapter = ({
  apiKey,
  fetch: fetchImplementation,
  diagnostics = console,
  spendObserver,
}: SupadataWebAdapterOptions) => ({
  scrape: async (pageUrl: string, signal: AbortSignal): Promise<string> => {
    if (!apiKey?.trim()) {
      diagnostics.warn("Supadata web scrape failed", {
        operation: "web-scrape",
        category: "configuration",
      });
      throw new ImportRecipeError("FETCH_FAILED");
    }

    const requestUrl = new URL(SUPADATA_WEB_SCRAPE_URL);
    requestUrl.searchParams.set("url", pageUrl);

    try {
      let response: Response;
      try {
        if (spendObserver) await spendObserver.onOperationStarted();
        response = await fetchImplementation(requestUrl, {
          headers: { "x-api-key": apiKey },
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new SupadataWebFailure("transport");
      }

      const billableRequests = response.headers.get("x-billable-requests");
      const knownCredits = creditsFromSupadataBillingHeader(billableRequests);
      if (knownCredits !== null && spendObserver) {
        await spendObserver.onCreditsKnown(knownCredits);
      }
      diagnostics.info("Supadata request completed", {
        operation: "web-scrape",
        status: response.status,
        billableRequests,
      });
      const body = await readJsonBody(response, billableRequests);

      if (!response.ok) {
        const providerError = providerErrorSchema.safeParse(body);
        throw new SupadataWebFailure(
          "provider",
          response.status,
          providerError.success
            ? providerError.data.error
            : "invalid-error-response",
          billableRequests,
        );
      }

      const parsed = webScrapeSchema.safeParse(body);
      if (!parsed.success || !parsed.data.content.trim()) {
        throw new SupadataWebFailure(
          "invalid-response",
          response.status,
          undefined,
          billableRequests,
        );
      }
      if (knownCredits === null && spendObserver) {
        await spendObserver.onCreditsKnown(1);
      }
      return parsed.data.content;
    } catch (error) {
      if (signal.aborted) throw error;
      const failure =
        error instanceof SupadataWebFailure
          ? error
          : new SupadataWebFailure("invalid-response");
      diagnostics.warn("Supadata web scrape failed", {
        operation: "web-scrape",
        category: failure.category,
        ...(failure.status === undefined ? {} : { status: failure.status }),
        ...(failure.providerCode ? { providerCode: failure.providerCode } : {}),
        ...(failure.billableRequests === undefined
          ? {}
          : { billableRequests: failure.billableRequests }),
      });
      throw new ImportRecipeError(
        failure.status === 429 ? "IMPORT_LIMIT_REACHED" : "FETCH_FAILED",
      );
    }
  },
});

const readJsonBody = async (
  response: Response,
  billableRequests: string | null,
): Promise<unknown> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_SUPADATA_RESPONSE_BYTES
  ) {
    throw new SupadataWebFailure(
      "response-too-large",
      response.status,
      undefined,
      billableRequests,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new SupadataWebFailure(
      "invalid-response",
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
        throw new SupadataWebFailure(
          "response-too-large",
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
    if (error instanceof SupadataWebFailure) throw error;
    throw new SupadataWebFailure(
      "invalid-response",
      response.status,
      undefined,
      billableRequests,
    );
  }
};

export const scrapeRecipeTextWithSupadata = async (
  pageUrl: string,
  requestSignal?: AbortSignal,
  spendObserver?: SupadataSpendObserver,
) => {
  const signal = requestSignal ?? new AbortController().signal;
  const { env } = await import("~/env");
  const adapter = createSupadataWebAdapter({
    apiKey: env.SUPADATA_API_KEY,
    fetch,
    spendObserver,
  });
  return adapter.scrape(pageUrl, signal);
};
