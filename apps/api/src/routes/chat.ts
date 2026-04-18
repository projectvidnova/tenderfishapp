import { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { db, projects, documents, costSnapshots, projectDescriptions, participants } from "@tenderfish/db";
import { eq, desc } from "drizzle-orm";
import { getEnv } from "../lib/env";

function getClient() {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

interface ChatBody {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export default async function chatRoutes(app: FastifyInstance) {
  // POST /projects/:id/chat — project-scoped conversational assistant
  app.post<{ Params: { id: string }; Body: ChatBody }>(
    "/projects/:id/chat",
    async (request, reply) => {
      const { message, history = [] } = request.body;
      if (!message?.trim()) return reply.code(400).send({ error: "message is required" });

      // Gather project context
      const [project, spd, docs, costs, parts] = await Promise.all([
        db.query.projects.findFirst({ where: eq(projects.id, request.params.id) }),
        db.query.projectDescriptions.findFirst({
          where: eq(projectDescriptions.projectId, request.params.id),
          orderBy: desc(projectDescriptions.createdAt),
        }),
        db.query.documents.findMany({ where: eq(documents.projectId, request.params.id) }),
        db.query.costSnapshots.findMany({ where: eq(costSnapshots.projectId, request.params.id) }),
        db.query.participants.findMany({ where: eq(participants.projectId, request.params.id) }),
      ]);

      if (!project) return reply.code(404).send({ error: "Project not found" });

      const systemPrompt = `You are a German construction project management assistant for TenderFish. You help architects and project managers navigate HOAI phases (LPH 1-9), DIN 276 cost structures, and tender processes.

Current project context:
- Name: ${project.name}
- Type: ${project.type || "unknown"}
- Lifecycle State: ${project.lifecycleState || "input_received"}
- Documents: ${docs.length} documents uploaded
- Cost Snapshots: ${costs.length} snapshots
- Participants: ${parts.length} participants
- SPD Status: ${spd?.status || "not created"}
${spd ? `- SPD Summary: ${JSON.stringify({ projectName: spd.projectName, projectType: spd.projectType, location: spd.location })}` : ""}

Be concise and practical. Answer in the same language the user writes in (German or English). Reference specific HOAI phases, DIN 276 cost groups, or VOB regulations when relevant. If you don't know something specific about the project, say so.`;

      try {
        const client = getClient();
        const env = getEnv();
        const response = await client.messages.create({
          model: env.AI_MODEL,
          max_tokens: env.AI_MAX_TOKENS_CHAT,
          system: systemPrompt,
          messages: [
            ...history.slice(-env.CHAT_HISTORY_LIMIT).map((h) => ({
              role: h.role as "user" | "assistant",
              content: h.content,
            })),
            { role: "user", content: message },
          ],
        });

        const text = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("");

        return { data: { role: "assistant", content: text } };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "AI service unavailable";
        return reply.code(503).send({ error: errorMsg });
      }
    }
  );
}
