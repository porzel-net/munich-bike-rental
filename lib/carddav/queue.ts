import { and, eq, lte } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { carddavSyncJobs } from "@/lib/db/schema";

import { syncAllEnabledCarddavAccounts } from "./sync";

const JOB_KEY = "contacts";
const RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

let workerInProgress = false;

export async function drainCarddavSyncQueue() {
  if (workerInProgress) return;

  const db = getDatabase();
  const now = new Date();
  const job = db
    .select()
    .from(carddavSyncJobs)
    .where(and(eq(carddavSyncJobs.jobKey, JOB_KEY), lte(carddavSyncJobs.nextAttemptAt, now)))
    .get();
  if (!job) return;

  workerInProgress = true;
  try {
    const revision = job.revision;
    const result = await syncAllEnabledCarddavAccounts();
    if (result.busy) return;

    if (result.failedAccounts === 0) {
      // Do not remove a newer event that was created while synchronization was
      // running. That event will be processed by the next worker tick.
      db.delete(carddavSyncJobs)
        .where(and(eq(carddavSyncJobs.id, job.id), eq(carddavSyncJobs.revision, revision)))
        .run();
      return;
    }

    const retryDelay = Math.min(MAX_RETRY_DELAY_MS, RETRY_DELAY_MS * 2 ** Math.min(job.attempts, 3));
    db.update(carddavSyncJobs)
      .set({
        nextAttemptAt: new Date(Date.now() + retryDelay),
        attempts: job.attempts + 1,
        lastError: `${result.failedAccounts} CardDAV-Konto/Konten konnten nicht synchronisiert werden.`,
      })
      .where(and(eq(carddavSyncJobs.id, job.id), eq(carddavSyncJobs.revision, revision)))
      .run();
  } finally {
    workerInProgress = false;
  }
}
