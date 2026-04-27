import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

// 👇 load from ROOT, not local folder
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["!pg_*", "!_pg_*"],
} satisfies Config;