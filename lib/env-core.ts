export type ExecutionMode = "demo" | "devnet" | "mainnet";
export type SolanaCluster = "devnet" | "mainnet-beta";
export type AiProvider = "demo" | "openai";

export type Environment = Readonly<{
  appUrl: string;
  cluster: SolanaCluster;
  executionMode: ExecutionMode;
  enableDemoMode: boolean;
  enableDevnetExecution: boolean;
  enableMainnetExecution: boolean;
  mainnetReleaseApproved: boolean;
  solanaRpcUrl?: string;
  databaseUrl?: string;
  sessionSecret?: string;
  clawpumpApiKey?: string;
  prestocksApiUrl: string;
  aiProvider: AiProvider;
  openaiApiKey?: string;
  openaiModel?: string;
}>;

export type PublicCapabilities = Readonly<{
  mode: ExecutionMode;
  cluster: SolanaCluster;
  demoAvailable: boolean;
  devnetExecutionAvailable: boolean;
  mainnetExecutionAvailable: boolean;
  walletAuthenticationConfigured: boolean;
  persistenceConfigured: boolean;
  solanaRpcConfigured: boolean;
  clawpumpConfigured: boolean;
  meteoraConfigured: boolean;
  aiConfigured: boolean;
  prestocksConfigured: boolean;
}>;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const VALID_EXECUTION_MODES = ["demo", "devnet", "mainnet"] as const;
const VALID_CLUSTERS = ["devnet", "mainnet-beta"] as const;
const VALID_AI_PROVIDERS = ["demo", "openai"] as const;

function readOptional(source: EnvironmentSource, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(
  source: EnvironmentSource,
  name: string,
  fallback: boolean,
): boolean {
  const value = readOptional(source, name);

  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`${name} must be either "true" or "false".`);
}

function readEnum<const T extends readonly string[]>(
  source: EnvironmentSource,
  name: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = readOptional(source, name) ?? fallback;

  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }

  return value;
}

function readUrl(
  source: EnvironmentSource,
  name: string,
  fallback?: string,
): string | undefined {
  const value = readOptional(source, name) ?? fallback;
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must use http or https.`);
  }

  return url.toString().replace(/\/$/, "");
}

function validateEnvironment(candidate: Environment): Environment {
  const errors: string[] = [];

  if (candidate.enableDevnetExecution && candidate.enableMainnetExecution) {
    errors.push(
      "ENABLE_DEVNET_EXECUTION and ENABLE_MAINNET_EXECUTION cannot both be true.",
    );
  }

  if (!candidate.enableDemoMode && candidate.executionMode === "demo") {
    errors.push("NAVIS_EXECUTION_MODE=demo requires ENABLE_DEMO_MODE=true.");
  }

  if (candidate.executionMode === "devnet") {
    if (!candidate.enableDevnetExecution) {
      errors.push("NAVIS_EXECUTION_MODE=devnet requires ENABLE_DEVNET_EXECUTION=true.");
    }
    if (candidate.cluster !== "devnet") {
      errors.push(
        "NAVIS_EXECUTION_MODE=devnet requires NEXT_PUBLIC_SOLANA_CLUSTER=devnet.",
      );
    }
  }

  if (candidate.executionMode === "mainnet") {
    if (!candidate.enableMainnetExecution) {
      errors.push(
        "NAVIS_EXECUTION_MODE=mainnet requires ENABLE_MAINNET_EXECUTION=true.",
      );
    }
    if (!candidate.mainnetReleaseApproved) {
      errors.push(
        "NAVIS_EXECUTION_MODE=mainnet requires MAINNET_RELEASE_APPROVED=true after the release checklist passes.",
      );
    }
    if (candidate.cluster !== "mainnet-beta") {
      errors.push(
        "NAVIS_EXECUTION_MODE=mainnet requires NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta.",
      );
    }
  }

  if (
    (candidate.enableDevnetExecution || candidate.enableMainnetExecution) &&
    !candidate.solanaRpcUrl
  ) {
    errors.push("SOLANA_RPC_URL is required whenever onchain execution is enabled.");
  }

  if (candidate.sessionSecret !== undefined && candidate.sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must contain at least 32 characters.");
  }

  if (candidate.aiProvider === "openai" && !candidate.openaiApiKey) {
    errors.push("AI_PROVIDER=openai requires OPENAI_API_KEY.");
  }
  if (candidate.aiProvider === "openai" && !candidate.openaiModel) {
    errors.push("AI_PROVIDER=openai requires OPENAI_MODEL.");
  }

  if (
    candidate.clawpumpApiKey !== undefined &&
    !candidate.clawpumpApiKey.startsWith("cpk_")
  ) {
    errors.push("CLAWPUMP_API_KEY must start with cpk_.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid Navis environment configuration:\n- ${errors.join("\n- ")}`,
    );
  }

  return Object.freeze(candidate);
}

export function parseEnvironment(source: EnvironmentSource): Environment {
  const appUrl = readUrl(source, "NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  const prestocksApiUrl = readUrl(
    source,
    "PRESTOCKS_API_URL",
    "https://prestocks.com/api/prestocks",
  );

  if (!appUrl || !prestocksApiUrl) {
    throw new Error("Navis URL configuration could not be resolved.");
  }

  return validateEnvironment({
    appUrl,
    cluster: readEnum(source, "NEXT_PUBLIC_SOLANA_CLUSTER", VALID_CLUSTERS, "devnet"),
    executionMode: readEnum(
      source,
      "NAVIS_EXECUTION_MODE",
      VALID_EXECUTION_MODES,
      "demo",
    ),
    enableDemoMode: readBoolean(source, "ENABLE_DEMO_MODE", true),
    enableDevnetExecution: readBoolean(source, "ENABLE_DEVNET_EXECUTION", false),
    enableMainnetExecution: readBoolean(source, "ENABLE_MAINNET_EXECUTION", false),
    mainnetReleaseApproved: readBoolean(source, "MAINNET_RELEASE_APPROVED", false),
    solanaRpcUrl: readUrl(source, "SOLANA_RPC_URL"),
    databaseUrl: readOptional(source, "DATABASE_URL"),
    sessionSecret: readOptional(source, "SESSION_SECRET"),
    clawpumpApiKey: readOptional(source, "CLAWPUMP_API_KEY"),
    prestocksApiUrl,
    aiProvider: readEnum(source, "AI_PROVIDER", VALID_AI_PROVIDERS, "demo"),
    openaiApiKey: readOptional(source, "OPENAI_API_KEY"),
    openaiModel: readOptional(source, "OPENAI_MODEL"),
  });
}

export function toPublicCapabilities(env: Environment): PublicCapabilities {
  return Object.freeze({
    mode: env.executionMode,
    cluster: env.cluster,
    demoAvailable: env.enableDemoMode,
    devnetExecutionAvailable: env.enableDevnetExecution && Boolean(env.solanaRpcUrl),
    mainnetExecutionAvailable:
      env.enableMainnetExecution &&
      env.mainnetReleaseApproved &&
      Boolean(env.solanaRpcUrl),
    walletAuthenticationConfigured: Boolean(env.sessionSecret),
    persistenceConfigured: Boolean(env.databaseUrl),
    solanaRpcConfigured: Boolean(env.solanaRpcUrl),
    clawpumpConfigured: Boolean(env.clawpumpApiKey),
    meteoraConfigured: Boolean(env.solanaRpcUrl),
    aiConfigured: env.aiProvider === "demo" || Boolean(env.openaiApiKey),
    prestocksConfigured: Boolean(env.prestocksApiUrl),
  });
}
