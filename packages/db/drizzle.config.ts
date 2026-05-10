import type { Config } from "drizzle-kit";

// In dev, load DATABASE_URL from the repo-root .env via dotenv.
// In production / CI the deploy environment sets DATABASE_URL directly, and
// dotenv isn't shipped with the prod image — so the require is optional.
if (!process.env.DATABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  } catch {
    // dotenv not installed (e.g. production container). DATABASE_URL must be
    // set externally in that case; the throw below will catch a missing value.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Provide it via env or a root .env file.");
}

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["!pg_*", "!_pg_*"],
} satisfies Config;