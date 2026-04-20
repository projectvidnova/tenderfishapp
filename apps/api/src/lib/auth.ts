/**
 * Better Auth configuration — email/password + social providers.
 * Uses Drizzle adapter with Postgres.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@tenderfish/db";
import * as schema from "@tenderfish/db";
import { getEnv } from "./env";

function createAuth() {
  const env = getEnv();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    baseURL: env.NEXT_PUBLIC_APP_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    advanced: {
      database: { generateId: "uuid" },
    } as any,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
        ? {
            microsoft: {
              clientId: env.MICROSOFT_CLIENT_ID,
              clientSecret: env.MICROSOFT_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
    user: {
      additionalFields: {
        workspaceId: {
          type: "string",
          required: false,
          fieldName: "workspace_id",
        },
        role: {
          type: "string",
          required: false,
          defaultValue: "team_member",
          fieldName: "role",
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,      // refresh session every 24h
    },
  });
}

let _auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!_auth) _auth = createAuth();
  return _auth;
}
