import { z, type ZodType } from "zod";

import {
  clawPumpAgentResponseSchema,
  clawPumpAgentsResponseSchema,
  clawPumpPairsResponseSchema,
  clawPumpSkillsResponseSchema,
  createClawPumpAgentInputSchema,
  selfFundedLaunchPreflightInputSchema,
  selfFundedLaunchPreflightResponseSchema,
  type CreateClawPumpAgentInput,
  type SelfFundedLaunchPreflightInput,
} from "./schemas";

const BASE_URL = "https://clawpump.tech/api/v1";

const errorResponseSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
  meta: z
    .object({
      timestamp: z.string().optional(),
      requestId: z.string().optional(),
    })
    .optional(),
});

export type ClawPumpErrorKind =
  | "unauthorized"
  | "payment_required"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "network"
  | "invalid_response";

export class ClawPumpError extends Error {
  constructor(
    message: string,
    readonly kind: ClawPumpErrorKind,
    readonly status?: number,
    readonly requestId?: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ClawPumpError";
  }
}

type RequestOptions<T> = Readonly<{
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  schema: ZodType<T>;
  timeoutMs?: number;
  idempotencyKey?: string;
}>;

type ClawPumpClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}>;

function mapStatus(status: number): ClawPumpErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  return "upstream";
}

export class ClawPumpClient {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ClawPumpClientOptions) {
    if (!/^cpk_[A-Za-z0-9_-]+$/.test(options.apiKey)) {
      throw new Error("ClawPump API keys must use the cpk_ format");
    }
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
      throw new Error("ClawPump paths must be relative to the supported v1 apex API");
    }
    const method = options.method ?? "GET";
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.timeoutMs,
    );

    try {
      const response = await this.fetcher(`${BASE_URL}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          accept: "application/json",
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.idempotencyKey
            ? { "idempotency-key": options.idempotencyKey }
            : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ClawPumpError(
          "ClawPump returned a non-JSON response",
          "invalid_response",
          response.status,
        );
      }

      if (!response.ok) {
        const parsed = errorResponseSchema.safeParse(payload);
        const requestId = parsed.success ? parsed.data.meta?.requestId : undefined;
        const kind = mapStatus(response.status);
        const retryable = response.status === 429 || response.status >= 500;
        throw new ClawPumpError(
          parsed.success && parsed.data.error
            ? parsed.data.error
            : `ClawPump request failed with HTTP ${response.status}`,
          kind,
          response.status,
          requestId,
          retryable,
        );
      }

      const parsed = options.schema.safeParse(payload);
      if (!parsed.success) {
        throw new ClawPumpError(
          "ClawPump returned a response that does not match its documented contract",
          "invalid_response",
          response.status,
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ClawPumpError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ClawPumpError(
          "ClawPump request timed out",
          "timeout",
          undefined,
          undefined,
          true,
        );
      }
      throw new ClawPumpError(
        "ClawPump request failed",
        "network",
        undefined,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  listSkills() {
    return this.request("/skills", { schema: clawPumpSkillsResponseSchema });
  }

  listAgents() {
    return this.request("/agents", { schema: clawPumpAgentsResponseSchema });
  }

  getPumpPairs() {
    return this.request("/pump-pairs", { schema: clawPumpPairsResponseSchema });
  }

  getAgent(agentId: string) {
    return this.request(`/agents/${encodeURIComponent(agentId)}`, {
      schema: clawPumpAgentResponseSchema,
    });
  }

  createAgent(input: CreateClawPumpAgentInput) {
    return this.request("/agents", {
      method: "POST",
      body: createClawPumpAgentInputSchema.parse(input),
      schema: clawPumpAgentResponseSchema,
      timeoutMs: 30_000,
    });
  }

  preflightSelfFundedLaunch(input: SelfFundedLaunchPreflightInput) {
    return this.request("/launch/self-funded", {
      method: "POST",
      body: selfFundedLaunchPreflightInputSchema.parse(input),
      schema: selfFundedLaunchPreflightResponseSchema,
      timeoutMs: 120_000,
    });
  }
}
