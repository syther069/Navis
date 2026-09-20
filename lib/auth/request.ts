import "server-only";

import { env } from "@/lib/env";

export function hasTrustedMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(env.appUrl).origin;
  } catch {
    return false;
  }
}
