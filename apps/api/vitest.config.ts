import { defineConfig } from "vitest/config";

// Tests are pure — no DB connection is opened. DATABASE_URL is set to a
// no-op value here so importing `@tenderfish/db` doesn't throw at module load.
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
