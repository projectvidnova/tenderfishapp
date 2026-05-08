import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./middleware/auth";
import { validateEnv } from "./lib/env";
import { workspaceRoutes } from "./routes/workspaces";
import { projectRoutes } from "./routes/projects";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { onboardingRoutes } from "./routes/onboarding";
import { invitationRoutes } from "./routes/invitations";
import { jobRoutes } from "./routes/jobs";
import { dashboardRoutes } from "./routes/dashboard";
import { phaseRoutes } from "./routes/phases";
import { gateRoutes } from "./routes/gates";
import { consultantRoutes } from "./routes/consultants";
import { documentRoutes } from "./routes/documents";
import { reviewRoutes } from "./routes/reviews";
import { inboxRoutes } from "./routes/inbox";
import { settingsRoutes } from "./routes/settings";
import { lifecycleRoutes } from "./routes/lifecycle";
import { costRoutes } from "./routes/costs";
import exportRoutes from "./routes/exports";
import chatRoutes from "./routes/chat";
import { gaebRoutes } from "./routes/gaeb";
import { accountRoutes } from "./routes/account";
import { contractRoutes } from "./routes/contracts";
import { siteRoutes } from "./routes/site";

// Validate environment variables at startup (fail fast)
const env = validateEnv();

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    // Generate request IDs for traceability
    genReqId: () => crypto.randomUUID(),
  });

  // ── Security headers ──────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP managed by Next.js frontend
  });

  // ── Rate limiting ─────────────────────────────────────────
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Stricter limits for auth endpoints (applied per-route below)
    allowList: [],
  });

  // ── CORS ──────────────────────────────────────────────────
  await app.register(cors, {
    origin: env.NEXT_PUBLIC_APP_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: env.CORS_MAX_AGE_SECONDS,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_BYTES,
    },
  });

  // ── Global error handler ──────────────────────────────────
  app.setErrorHandler((error: any, request, reply) => {
    // Zod / validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: "Validation Error",
        message: error.message,
      });
    }

    // Rate limit exceeded
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
      });
    }

    // Known HTTP errors
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.name || "Error",
        message: error.message,
      });
    }

    // Unexpected errors — log full details, return safe message
    request.log.error({ err: error, reqId: request.id }, "Unhandled error");
    return reply.status(500).send({
      error: "Internal Server Error",
      message: env.NODE_ENV === "development" ? error.message : "An unexpected error occurred",
    });
  });

  // ── Not found handler ─────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: "Not Found",
      message: "The requested endpoint does not exist",
    });
  });

  // Auth middleware
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(onboardingRoutes, { prefix: "/api" });
  await app.register(invitationRoutes, { prefix: "/api" });
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.register(projectRoutes, { prefix: "/api" });
  await app.register(jobRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });
  await app.register(phaseRoutes, { prefix: "/api" });
  await app.register(gateRoutes, { prefix: "/api" });
  await app.register(consultantRoutes, { prefix: "/api" });
  await app.register(documentRoutes, { prefix: "/api" });
  await app.register(reviewRoutes, { prefix: "/api" });
  await app.register(inboxRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api" });
  await app.register(lifecycleRoutes, { prefix: "/api" });
  await app.register(costRoutes, { prefix: "/api" });
  await app.register(exportRoutes, { prefix: "/api" });
  await app.register(chatRoutes, { prefix: "/api" });
  await app.register(gaebRoutes, { prefix: "/api" });
  await app.register(accountRoutes, { prefix: "/api" });
  await app.register(contractRoutes, { prefix: "/api" });
  await app.register(siteRoutes, { prefix: "/api" });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
