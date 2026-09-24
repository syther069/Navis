import { MeteoraQuoteProfileError } from "./quote-profiles";

/** Only locally authored, credential-free errors may cross the API boundary. */
export class MeteoraClusterError extends Error {
  constructor() {
    super(
      "Meteora RPC cluster verification failed. No transaction operation was performed.",
    );
    this.name = "MeteoraClusterError";
  }
}

export function meteoraPublicErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof MeteoraClusterError ||
    error instanceof MeteoraQuoteProfileError
  ) {
    return error.message;
  }
  // SDK, RPC and database errors may contain endpoint credentials or SQL.
  return fallback;
}
