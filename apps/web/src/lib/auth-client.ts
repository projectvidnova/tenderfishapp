import { createAuthClient } from "better-auth/react";
import { config } from "./config";

const authClient = createAuthClient({
  baseURL: config.apiUrl,
});

// Explicit type annotation avoids TS4023 "inferred type cannot be named"
// caused by better-auth internal .mjs module references
type AuthClient = ReturnType<typeof createAuthClient>;

export const signIn: AuthClient["signIn"] = authClient.signIn;
export const signUp: AuthClient["signUp"] = authClient.signUp;
export const signOut: AuthClient["signOut"] = authClient.signOut;
export const useSession: AuthClient["useSession"] = authClient.useSession;
export const getSession: AuthClient["getSession"] = authClient.getSession;
