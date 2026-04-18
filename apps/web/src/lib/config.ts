/**
 * Centralized frontend configuration.
 * All environment-dependent values live here — no hardcoded URLs in pages.
 */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
} as const;
