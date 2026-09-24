import "@workspace/navis-core/server/only";

import { parseEnvironment, toPublicCapabilities } from "./env-core";

export type { PublicCapabilities } from "./env-core";

export const env = parseEnvironment(process.env);

export function getPublicCapabilities() {
  return toPublicCapabilities(env);
}
