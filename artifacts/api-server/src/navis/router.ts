import express, { Router } from "express";
import { NextRequest } from "@workspace/navis-core/server/http";
import { originalRoutes } from "./routes";
import { workspace } from "./workspace";

const router = Router();
// Preserve original JSON parsing/error behavior by passing raw bytes to Fetch.
router.use(express.raw({ type: () => true, limit: "2mb" }));
type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
for (const [path, module] of [...originalRoutes, ["/workspace", { GET: workspace }]] as const) {
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
    const handler = (module as unknown as Record<string, Handler>)[method];
    if (!handler) continue;
    router.route(path)[method.toLowerCase() as "get"](async (req, res): Promise<void> => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const request = new NextRequest(`${req.protocol}://${req.get("host")}${req.originalUrl}`, {
        method,
        headers,
        ...(method !== "GET" && Buffer.isBuffer(req.body) && req.body.length ? { body: new Uint8Array(req.body) } : {}),
      });
      const params = Object.fromEntries(Object.entries(req.params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
      const result = await handler(request, { params: Promise.resolve(params) });
      res.status(result.status);
      result.headers.forEach((value, key) => {
        if (key !== "set-cookie") res.setHeader(key, value);
      });
      const cookies = result.headers.getSetCookie();
      if (cookies.length) res.setHeader("set-cookie", cookies);
      res.send(Buffer.from(await result.arrayBuffer()));
    });
  }
}
export default router;