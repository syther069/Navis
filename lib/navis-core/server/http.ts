/** Native Fetch adapters for the original route contracts, without Next.js. */
export class NextRequest extends Request {
  get cookies() {
    return {
      get: (name: string) => {
        const pair = (this.headers.get("cookie") ?? "")
          .split(";")
          .map((item) => item.trim())
          .find((item) => item.startsWith(`${name}=`));
        if (!pair) return undefined;
        try {
          return { name, value: decodeURIComponent(pair.slice(name.length + 1)) };
        } catch {
          return undefined;
        }
      },
    };
  }
}

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

export class NextResponse extends Response {
  static override json(body: unknown, init?: ResponseInit): NextResponse {
    const response = Response.json(body, init);
    return new NextResponse(response.body, response);
  }
  readonly cookies = {
    set: (name: string, value: string, options: CookieOptions = {}) => {
      const parts = [`${name}=${encodeURIComponent(value)}`];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      this.headers.append("Set-Cookie", parts.join("; "));
    },
  };
}