import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/redis";
import { isAuthorized } from "@/lib/auth";
import { JobSafeStatus } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing shared secret" },
      { status: 401 }
    );
  }

  const job = await getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Calculate latency metrics
  let avgLatency: number | null = null;
  let minLatency: number | null = null;
  let maxLatency: number | null = null;

  if (job.latencies.length > 0) {
    const sum = job.latencies.reduce((acc, val) => acc + val, 0);
    avgLatency = Math.round(sum / job.latencies.length);
    minLatency = Math.min(...job.latencies);
    maxLatency = Math.max(...job.latencies);
  }

  // Return safe subset omitting sensitive headers/body
  const safeStatus: JobSafeStatus = {
    id: job.id,
    createdAt: job.createdAt,
    status: job.status,
    sent: job.sent,
    maxRequests: job.maxRequests,
    maxDurationMinutes: job.maxDurationMinutes,
    batchSize: job.batchSize,
    delayMs: job.delayMs,
    statusCounts: job.statusCounts,
    first429At: job.first429At,
    latencies: job.latencies,
    lastTickAt: job.lastTickAt,
    targetUrl: job.target.url,
    targetMethod: job.target.method,
    error: job.error,
    avgLatency,
    minLatency,
    maxLatency,
    autoCsrf: job.target.autoCsrf,
    followRedirects: job.target.followRedirects,
    expectJson: job.target.expectJson,
    responseSamples: job.responseSamples || {},
  };

  return NextResponse.json(safeStatus);
}
