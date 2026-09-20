import "server-only";

import { env } from "../../env";
import { ClawPumpClient } from "./client";

export function createClawPumpClient() {
  if (!env.clawpumpApiKey) throw new Error("CLAWPUMP_API_KEY is not configured");
  return new ClawPumpClient({ apiKey: env.clawpumpApiKey });
}
