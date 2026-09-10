import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/redis";
import { cancelTick } from "@/lib/qstash";
import { isAuthorized } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing shared secret" },
      { status: 401 }
    );
  }

  const jobId = params.id;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const previousStatus = job.status;

  if (job.status === "running") {
    job.status = "stopped";
    job.lastTickAt = Date.now();

    // Cancel pending QStash delayed message if one was scheduled
    if (job.qstashScheduleId) {
      const canceled = await cancelTick(job.qstashScheduleId);
      console.log(`[Job Stop] Job ${jobId}: QStash pending message ${job.qstashScheduleId} cancellation result: ${canceled}`);
    }

    await saveJob(job);
    console.log(
      `[Job Stopped] id=${job.id} Target=${job.target.url} SentAtStop=${job.sent}/${job.maxRequests} Statuses=${JSON.stringify(job.statusCounts)}`
    );
  }

  return NextResponse.json({
    id: job.id,
    previousStatus,
    status: job.status,
    sent: job.sent,
    message: job.status === "stopped" ? "Job successfully stopped" : `Job was already ${job.status}`,
  });
}
