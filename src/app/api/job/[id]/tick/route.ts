import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/redis";
import { executeBatch } from "@/lib/executor";
import { scheduleTick, verifyTickSignature } from "@/lib/qstash";
import { getBaseUrl } from "@/lib/url";
import { GUARDRAILS } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const rawBody = await req.text();

  // 1. Verify QStash Signature
  const isSignatureValid = await verifyTickSignature(req, rawBody);
  if (!isSignatureValid) {
    console.warn(`[Tick] Unauthorized tick attempt for job ${jobId}: invalid QStash signature`);
    return NextResponse.json(
      { error: "Unauthorized: Invalid QStash signature" },
      { status: 401 }
    );
  }

  // 2. Load Job record
  const job = await getJob(jobId);
  if (!job) {
    console.warn(`[Tick] Job ${jobId} not found`);
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // 3. STOP GUARD: If status is not "running", exit immediately!
  // This ensures that when the user clicks Stop, no further batches are fired.
  if (job.status !== "running") {
    console.log(`[Tick] Job ${jobId} is in status '${job.status}'. Skipping execution.`);
    return NextResponse.json({
      status: job.status,
      message: `Job is ${job.status}; tick skipped.`,
    });
  }

  const now = Date.now();
  const elapsedMinutes = (now - job.createdAt) / 60000;

  // 4. Check Duration Stop Condition
  if (elapsedMinutes >= job.maxDurationMinutes) {
    job.status = "completed";
    job.lastTickAt = now;
    await saveJob(job);
    console.log(
      `[Job Completed] id=${job.id} Reason=MaxDurationReached (${elapsedMinutes.toFixed(1)}m >= ${job.maxDurationMinutes}m) TotalSent=${job.sent} Statuses=${JSON.stringify(job.statusCounts)}`
    );
    return NextResponse.json({
      status: "completed",
      reason: "Max duration reached",
      sent: job.sent,
    });
  }

  // 5. Check Request Count Stop Condition
  if (job.sent >= job.maxRequests) {
    job.status = "completed";
    job.lastTickAt = now;
    await saveJob(job);
    console.log(
      `[Job Completed] id=${job.id} Reason=MaxRequestsReached (${job.sent} >= ${job.maxRequests}) Statuses=${JSON.stringify(job.statusCounts)}`
    );
    return NextResponse.json({
      status: "completed",
      reason: "Max requests reached",
      sent: job.sent,
    });
  }

  // 6. Calculate batch size for this tick (don't exceed remaining quota)
  const remainingQuota = job.maxRequests - job.sent;
  const currentBatchSize = Math.min(job.batchSize, remainingQuota);

  // 7. Execute batch in parallel
  const batchResult = await executeBatch(job.target, currentBatchSize);

  // 8. Update stats
  const previousSent = job.sent;
  job.sent += batchResult.items.length;
  job.lastTickAt = Date.now();

  for (let i = 0; i < batchResult.items.length; i++) {
    const item = batchResult.items[i];
    job.statusCounts[item.status] = (job.statusCounts[item.status] || 0) + 1;

    // Track first 429 occurrence index
    if (item.statusCode === 429 && job.first429At === null) {
      job.first429At = previousSent + i + 1;
      console.log(
        `[Rate Limit Hit] Job ${job.id} encountered first 429 at request #${job.first429At}`
      );
    }
  }

  // Update rolling latencies (keep capped at last 200 entries to prevent Redis bloat)
  const newLatencies = batchResult.items.map((it) => it.latencyMs);
  job.latencies = [...job.latencies, ...newLatencies].slice(
    -GUARDRAILS.MAX_LATENCY_HISTORY
  );

  // 9. Re-check if this batch satisfied completion
  if (job.sent >= job.maxRequests) {
    job.status = "completed";
    await saveJob(job);
    console.log(
      `[Job Completed] id=${job.id} Target=${job.target.url} Sent=${job.sent}/${job.maxRequests} Statuses=${JSON.stringify(job.statusCounts)} First429At=${job.first429At ?? "none"}`
    );
    return NextResponse.json({
      status: "completed",
      sent: job.sent,
      first429At: job.first429At,
    });
  }

  // 10. Self-rescheduling: Schedule NEXT tick
  try {
    const baseUrl = getBaseUrl(req);
    const nextScheduleId = await scheduleTick(job.id, job.delayMs, baseUrl);
    job.qstashScheduleId = nextScheduleId;
  } catch (err: any) {
    console.error(`[Tick Reschedule Error] Job ${job.id}:`, err);
    job.status = "failed";
    job.error = `Failed to reschedule tick: ${err.message}`;
    await saveJob(job);
    return NextResponse.json(
      { error: "Failed to schedule next tick", details: err.message },
      { status: 500 }
    );
  }

  // Persist updated job state
  await saveJob(job);

  return NextResponse.json({
    status: job.status,
    sent: job.sent,
    batchSize: currentBatchSize,
    first429At: job.first429At,
    statusCounts: job.statusCounts,
  });
}
