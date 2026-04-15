/**
 * Cloud Function — AI Pipeline Worker
 * Triggered by Cloud Tasks or HTTP call.
 * Deploys with: gcloud functions deploy ai-worker --runtime nodejs20 --trigger-http
 * No Docker needed.
 */

import { db, jobs } from "@tenderfish/db";
import { eq } from "drizzle-orm";

async function processJob(job: typeof jobs.$inferSelect) {
  console.log(`[worker] Processing job ${job.id} type=${job.type}`);

  await db
    .update(jobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(jobs.id, job.id));

  const steps = (job.steps || []) as { key: string; label: string; status: string }[];
  for (const step of steps) {
    step.status = "complete";
    await db
      .update(jobs)
      .set({ currentStep: step.key, steps, updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
  }

  await db
    .update(jobs)
    .set({ status: "complete", updatedAt: new Date() })
    .where(eq(jobs.id, job.id));

  console.log(`[worker] Job ${job.id} complete`);
}

/**
 * HTTP entry point — called by Cloud Tasks queue or directly.
 * POST body: { jobId?: string }
 */
export async function aiWorker(req: { body?: { jobId?: string } }) {
  const { jobId } = req?.body || {};

  const job = jobId
    ? await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) })
    : await db.query.jobs.findFirst({
        where: eq(jobs.status, "pending"),
        orderBy: (jobs, { asc }) => [asc(jobs.createdAt)],
      });

  if (!job) {
    return { status: "no_pending_jobs" };
  }

  try {
    await processJob(job);
    return { status: "complete", jobId: job.id };
  } catch (err) {
    console.error(`[worker] Job ${job.id} failed:`, err);
    await db
      .update(jobs)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    return { status: "failed", jobId: job.id };
  }
}
