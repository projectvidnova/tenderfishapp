import { db } from "./index";
import { workspaces, users } from "./schema";
import { sql } from "drizzle-orm";

const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

async function seedDev() {
  console.log("Seeding dev workspace and user...");

  await db.execute(sql`
    INSERT INTO workspaces (id, name, slug, plan, inbox_email, country, default_timezone)
    VALUES (
      ${DEV_WORKSPACE_ID},
      'Dev Workspace',
      'dev-workspace',
      'professional',
      'dev-inbox@tenderfish.local',
      'Germany',
      'Europe/Berlin'
    )
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO users (id, workspace_id, clerk_id, email, name, role)
    VALUES (
      ${DEV_USER_ID},
      ${DEV_WORKSPACE_ID},
      'dev-clerk-001',
      'dev@tenderfish.local',
      'Dev Admin',
      'architect_admin'
    )
    ON CONFLICT (id) DO NOTHING
  `);

  console.log("Dev seed complete.");
  process.exit(0);
}

seedDev().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
