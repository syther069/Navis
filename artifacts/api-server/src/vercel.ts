import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

/**
 * Vercel serverless entry. Vercel rewrites every `/api/*` request to this
 * function while preserving the original request URL, so the Express app keeps
 * the exact same `/api/*` routes it serves in the long-running server.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
