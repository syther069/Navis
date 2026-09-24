import express, { type Express } from "express";
import navisRouter from "./navis/router";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use("/api", navisRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log.error({ errorType: error instanceof Error ? error.name : typeof error }, "NAVIS request failed");
  res.status(503).set("Cache-Control", "private, no-store").json({ error: "The service is temporarily unavailable. Try again." });
});

export default app;
