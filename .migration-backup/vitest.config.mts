import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": root,
      "server-only": fileURLToPath(
        new URL("tests/mocks/server-only.ts", import.meta.url),
      ),
    },
  },
});
