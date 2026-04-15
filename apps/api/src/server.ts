import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { clerkPlugin } from "./middleware/clerk";
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

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins
  await app.register(cors, {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002",
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // Auth middleware
  await app.register(clerkPlugin);

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

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
