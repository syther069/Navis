import { z, type ZodType } from "zod";

import {
  clawPumpAgentResponseSchema,
  clawPumpAgentsResponseSchema,
  clawPumpPairsResponseSchema,
  clawPumpSkillsResponseSchema,
  createClawPumpAgentInputSchema,
  selfFundedLaunchCostResponseSchema,
  selfFundedLaunchPreflightInputSchema,
  selfFundedLaunchPreflightResponseSchema,
  type CreateClawPumpAgentInput,
  type SelfFundedLaunchPreflightInput,
} from "./schemas";

/**
 * Apex host only. agents.clawpump.tech answers with a host-wide 308 and HTTP
 * clients drop the Authorization header across that redirect, so every call
 * sent there arrives unauthenticated. `redirect: "error"` below enforces it.
 */
export const CLAWPUMP_BASE_URL = "https://clawpump.tech/api/v1";

/** Documented in the Partner API: launches and x402 terms are Solana mainnet. */
export const CLAWPUMP_NETWORK = "mainnet-beta" as const;

const errorResponseSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
  missing: z.array(z.string()).optional(),
  invalidFields: z.array(z.string()).optional(),
  expectedWalletAddress: z.string().optional(),
  mintAddress: z.string().optional(),
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
  | "conflict"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "network"
  | "invalid_response";

/**
 * Sanitised, provider-echoed detail that is safe to persist and show: our own
 * field names, a documented error code, and public addresses. Never the raw
 * body.
 */
export type ClawPumpErrorDetails = Readonly<{
  code?: string;
  missing?: readonly string[];
  invalidFields?: readonly string[];
  expectedWalletAddress?: string;
  mintAddress?: string;
}>;

export class ClawPumpError extends Error {
  constructor(
    message: string,
    readonly kind: ClawPumpErrorKind,
    readonly status?: number,
    readonly requestId?: string,
    readonly retryable = false,
    readonly details: ClawPumpErrorDetails = {},
  ) {
    super(message);
    this.name = "ClawPumpError";
  }
}

export function getClawPumpPublicError(error: ClawPumpError) {
  if (error.kind === "payment_required") {
    return {
      status: 402,
      message:
        "ClawPump requires a different payment path. Navis will not relay or authorize unverified payment terms.",
    } as const;
  }

  return {
    status: error.kind === "forbidden" ? 403 : 502,
    message: `ClawPump preflight is unavailable (${error.kind}).`,
  } as const;
}

type RequestOptions<T> = Readonly<{
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  schema: ZodType<T>;
  timeoutMs?: number;
  idempotencyKey?: string;
  /**
   * Bounded retries on 429 and 5xx. Only safe for idempotent reads; write
   * paths keep the default of zero because the provider documents most write
   * endpoints as non-idempotent.
   */
  maxRetries?: number;
}>;

type ClawPumpClientOptions = Readonly<{
  apiKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  /** In-flight request ceiling. The provider suggests 10 or fewer. */
  maxConcurrency?: number;
  /** Retry budget for idempotent GET calls. */
  maxRetries?: number;
  /** Base delay for exponential backoff; tests pass a small value. */
  retryBaseDelayMs?: number;
  /** Injected for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}>;

function mapStatus(status: number): ClawPumpErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 402) return "payment_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  return "upstream";
}

/** Honour Retry-After in seconds or as an HTTP date; cap it so a hostile header cannot stall a request. */
export function parseRetryAfterMs(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(date - now, 0), 30_000);
}

/** Small FIFO semaphore so page loads never fan out beyond the cap. */
class ConcurrencyGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
    } else {
      await new Promise<void>((resolve) => this.queue.push(resolve));
      this.active += 1;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    };
  }
}

export type ClawPumpAvailability =
  | {
      status: "connected";
      requestId: string;
      timestamp: string;
      endpoint: "/agents" | "/skills";
      httpStatus: 200;
      agentCount: number;
      /** Opaque provider agent ids; public identifiers, never key material. */
      agentIds: readonly string[];
      /**
       * Whether GET /agents answered. A key can authenticate (/skills,
       * /pump-pairs) yet be refused on /agents with 403 until the provider
       * links it to an account; agent create, attach and launch then fail.
       */
      agentAccess: "granted" | "forbidden" | "unknown";
      /** Sanitised text of the /agents failure when access was not granted. */
      agentAccessError: string | null;
    }
  | {
      status: "unauthorised" | "unreachable";
      kind: ClawPumpErrorKind;
      httpStatus?: number;
      requestId?: string;
      endpoint: "/agents" | "/skills";
      safeError: string;
    };

export class ClawPumpClient {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly gate: ConcurrencyGate;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: ClawPumpClientOptions) {
    if (!/^cpk_[A-Za-z0-9_-]+$/.test(options.apiKey)) {
      throw new Error("ClawPump API keys must use the cpk_ format");
    }
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.gate = new ConcurrencyGate(options.maxConcurrency ?? 4);
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
      throw new Error("ClawPump paths must be relative to the supported v1 apex API");
    }
    const method = options.method ?? "GET";
    const maxRetries = method === "GET" ? (options.maxRetries ?? this.maxRetries) : 0;

    let attempt = 0;
    for (;;) {
      try {
        return await this.send(path, method, options);
      } catch (error) {
        if (
          !(error instanceof ClawPumpError) ||
          !error.retryable ||
          error.kind === "timeout" ||
          error.kind === "network" ||
          attempt >= maxRetries
        ) {
          throw error;
        }
        const retryAfter = retryAfterHints.get(error);
        retryAfterHints.delete(error);
        const backoff = this.retryBaseDelayMs * 2 ** attempt;
        await this.sleep(retryAfter ?? backoff);
        attempt += 1;
      }
    }
  }

  private async send<T>(
    path: string,
    method: "GET" | "POST" | "DELETE",
    options: RequestOptions<T>,
  ): Promise<T> {
    const release = await this.gate.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? this.timeoutMs,
    );

    try {
      const response = await this.fetcher(`${CLAWPUMP_BASE_URL}${path}`, {
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
          undefined,
          response.status === 429 || response.status >= 500,
        );
      }

      if (!response.ok) {
        const parsed = errorResponseSchema.safeParse(payload);
        const requestId = parsed.success ? parsed.data.meta?.requestId : undefined;
        const kind = mapStatus(response.status);
        const retryable = response.status === 429 || response.status >= 500;
        const error = new ClawPumpError(
          parsed.success && parsed.data.error
            ? parsed.data.error
            : `ClawPump request failed with HTTP ${response.status}`,
          kind,
          response.status,
          requestId,
          retryable,
          parsed.success
            ? {
                code: parsed.data.code,
                missing: parsed.data.missing,
                invalidFields: parsed.data.invalidFields,
                expectedWalletAddress: parsed.data.expectedWalletAddress,
                mintAddress: parsed.data.mintAddress,
              }
            : {},
        );
        if (retryable) {
          const hint = parseRetryAfterMs(response.headers.get("retry-after"));
          if (hint !== null) retryAfterHints.set(error, hint);
        }
        throw error;
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
      release();
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

  /** Cost discovery. An estimate by contract; the exact amount comes from the preflight quote. */
  getSelfFundedLaunchCost(quoteMint?: string) {
    const query = quoteMint ? `?quoteMint=${encodeURIComponent(quoteMint)}` : "";
    return this.request(`/launch/self-funded${query}`, {
      schema: selfFundedLaunchCostResponseSchema,
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

  /**
   * Availability probe from a real authenticated response. Prefers GET
   * /agents because it proves the key is linked to an account; falls back to
   * GET /skills only when /agents fails for a reason other than the key.
   */
  async probeAvailability(): Promise<ClawPumpAvailability> {
    try {
      const agents = await this.listAgents();
      return {
        status: "connected",
        requestId: agents.meta.requestId,
        timestamp: agents.meta.timestamp,
        endpoint: "/agents",
        httpStatus: 200,
        agentCount: agents.agents.length,
        agentIds: agents.agents.map((agent) => agent.id),
        agentAccess: "granted",
        agentAccessError: null,
      };
    } catch (error) {
      const primary = toAvailabilityFailure(error, "/agents");
      // 401 means the key itself is bad: stop. Any other /agents failure
      // falls back to /skills, which still proves the credential. Only a real
      // HTTP 403 is recorded as "forbidden" (key not linked to an account);
      // timeouts, 5xx, 404 and schema failures stay "unknown" with their
      // own sanitised reason so an outage is never reported as a missing
      // account link.
      if (primary.kind === "unauthorized") return primary;
      const agentAccess = primary.httpStatus === 403 ? "forbidden" : "unknown";
      try {
        const skills = await this.listSkills();
        return {
          status: "connected",
          requestId: skills.meta.requestId,
          timestamp: skills.meta.timestamp,
          endpoint: "/skills",
          httpStatus: 200,
          agentCount: 0,
          agentIds: [],
          agentAccess,
          agentAccessError: primary.safeError,
        };
      } catch (fallbackError) {
        return toAvailabilityFailure(fallbackError, "/skills");
      }
    }
  }
}

// Retry-After hints ride alongside the thrown error without widening the
// public error shape; entries are removed as soon as they are consumed.
const retryAfterHints = new WeakMap<ClawPumpError, number>();

function toAvailabilityFailure(
  error: unknown,
  endpoint: "/agents" | "/skills",
): Extract<ClawPumpAvailability, { status: "unauthorised" | "unreachable" }> {
  if (error instanceof ClawPumpError) {
    return {
      status:
        error.kind === "unauthorized" || error.kind === "forbidden"
          ? "unauthorised"
          : "unreachable",
      kind: error.kind,
      httpStatus: error.status,
      requestId: error.requestId,
      endpoint,
      safeError: describeClawPumpError(error),
    };
  }
  return {
    status: "unreachable",
    kind: "network",
    endpoint,
    safeError: "ClawPump request failed",
  };
}

/** Credential-free, body-free description suitable for logs, evidence rows and the UI. */
export function describeClawPumpError(error: ClawPumpError): string {
  const status = error.status ? ` (HTTP ${error.status})` : "";
  switch (error.kind) {
    case "unauthorized":
      return `ClawPump rejected the API key${status}. Check CLAWPUMP_API_KEY: it must be an active cpk_ Partner key sent to the apex host.`;
    case "forbidden":
      return `ClawPump refused access${status}: the key is not linked to an account or does not own the referenced agent.`;
    case "payment_required":
      return `ClawPump answered with payment terms${status}. Navis does not relay payments.`;
    case "not_found":
      return `ClawPump could not find the resource${status}.`;
    case "validation":
      return `ClawPump rejected the request parameters${status}${
        error.details.code ? ` [${error.details.code}]` : ""
      }.`;
    case "conflict":
      return `ClawPump reported a conflict${status}${
        error.details.code ? ` [${error.details.code}]` : ""
      }.`;
    case "rate_limited":
      return `ClawPump rate limit reached${status}; retried with backoff.`;
    case "upstream":
      return `ClawPump upstream error${status}.`;
    case "timeout":
      return "ClawPump request timed out.";
    case "network":
      return "ClawPump could not be reached.";
    case "invalid_response":
      return `ClawPump returned a response outside its documented contract${status}.`;
  }
}
