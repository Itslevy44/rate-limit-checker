import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Job, GUARDRAILS, CreateJobPayload } from "@/lib/types";
import { isAuthorized } from "@/lib/auth";
import { saveJob } from "@/lib/redis";
import { scheduleTick } from "@/lib/qstash";
import { getBaseUrl } from "@/lib/url";

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing shared secret" },
      { status: 401 }
    );
  }

  let body: CreateJobPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // 1. Validate Target URL
  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json(
      { error: "Field 'url' is required and must be a valid URL string" },
      { status: 400 }
    );
  }

  const trimmedUrl = body.url.trim();
  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "Target URL must use http or https protocol" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Target URL is malformed" },
      { status: 400 }
    );
  }

  // 2. Validate & Guardrail Max Requests (REQUIRED)
  if (
    body.maxRequests === undefined ||
    body.maxRequests === null ||
    typeof body.maxRequests !== "number" ||
    isNaN(body.maxRequests)
  ) {
    return NextResponse.json(
      { error: "Field 'maxRequests' is required and must be a positive number" },
      { status: 400 }
    );
  }

  const maxRequests = Math.floor(body.maxRequests);
  if (maxRequests < GUARDRAILS.MIN_REQUESTS) {
    return NextResponse.json(
      { error: `Field 'maxRequests' must be at least ${GUARDRAILS.MIN_REQUESTS}` },
      { status: 400 }
    );
  }
  if (maxRequests > GUARDRAILS.MAX_REQUESTS_CEILING) {
    return NextResponse.json(
      {
        error: `Field 'maxRequests' exceeds maximum ceiling of ${GUARDRAILS.MAX_REQUESTS_CEILING.toLocaleString()}`,
      },
      { status: 400 }
    );
  }

  // 3. Validate & Guardrail Max Duration Minutes (REQUIRED)
  if (
    body.maxDurationMinutes === undefined ||
    body.maxDurationMinutes === null ||
    typeof body.maxDurationMinutes !== "number" ||
    isNaN(body.maxDurationMinutes)
  ) {
    return NextResponse.json(
      { error: "Field 'maxDurationMinutes' is required and must be a positive number" },
      { status: 400 }
    );
  }

  const maxDurationMinutes = Math.floor(body.maxDurationMinutes);
  if (maxDurationMinutes < GUARDRAILS.MIN_DURATION_MINUTES) {
    return NextResponse.json(
      { error: `Field 'maxDurationMinutes' must be at least ${GUARDRAILS.MIN_DURATION_MINUTES} minute` },
      { status: 400 }
    );
  }
  if (maxDurationMinutes > GUARDRAILS.MAX_DURATION_MINUTES_CEILING) {
    return NextResponse.json(
      {
        error: `Field 'maxDurationMinutes' exceeds maximum ceiling of ${GUARDRAILS.MAX_DURATION_MINUTES_CEILING} minutes`,
      },
      { status: 400 }
    );
  }

  // 4. Batch Size (default 5, capped at 100)
  const rawBatch = typeof body.batchSize === "number" ? Math.floor(body.batchSize) : GUARDRAILS.DEFAULT_BATCH_SIZE;
  const batchSize = Math.max(
    GUARDRAILS.MIN_BATCH_SIZE,
    Math.min(rawBatch, GUARDRAILS.MAX_BATCH_SIZE_CEILING)
  );

  // 5. Delay ms (default 1000ms, bounds: 100ms - 60000ms)
  const rawDelay = typeof body.delayMs === "number" ? Math.floor(body.delayMs) : GUARDRAILS.DEFAULT_DELAY_MS;
  const delayMs = Math.max(
    GUARDRAILS.MIN_DELAY_MS,
    Math.min(rawDelay, GUARDRAILS.MAX_DELAY_MS)
  );

  const jobId = crypto.randomUUID();
  const method = (body.method || "GET").toUpperCase();
  const headers = body.headers && typeof body.headers === "object" ? body.headers : {};
  const requestBody = typeof body.body === "string" ? body.body : undefined;

  const job: Job = {
    id: jobId,
    createdAt: Date.now(),
    target: {
      url: trimmedUrl,
      method,
      headers,
      body: requestBody,
      autoCsrf: Boolean(body.autoCsrf),
      csrfUrl: body.csrfUrl ? String(body.csrfUrl).trim() : undefined,
      followRedirects: Boolean(body.followRedirects),
      expectJson: body.expectJson !== false,
    },
    batchSize,
    delayMs,
    maxRequests,
    maxDurationMinutes,
    status: "running",
    sent: 0,
    statusCounts: {},
    first429At: null,
    latencies: [],
    lastTickAt: Date.now(),
    qstashScheduleId: "",
  };

  // Schedule first tick
  try {
    const baseUrl = getBaseUrl(req);
    const scheduleId = await scheduleTick(jobId, delayMs, baseUrl);
    job.qstashScheduleId = scheduleId;
  } catch (err: any) {
    console.error(`[Job Init] Failed to schedule initial tick for ${jobId}:`, err);
    return NextResponse.json(
      { error: `Could not schedule job tick: ${err.message}` },
      { status: 500 }
    );
  }

  // Persist initial job record
  await saveJob(job);

  console.log(
    `[Job Created] id=${job.id} target=${job.target.method} ${job.target.url} batchSize=${job.batchSize} delay=${job.delayMs}ms maxRequests=${job.maxRequests} maxDuration=${job.maxDurationMinutes}m`
  );

  return NextResponse.json({
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    maxRequests: job.maxRequests,
    maxDurationMinutes: job.maxDurationMinutes,
  });
}
