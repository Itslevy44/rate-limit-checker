export type JobTarget = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type JobStatus = "running" | "stopped" | "completed" | "failed";

export type Job = {
  id: string;
  createdAt: number;

  // Configuration set at creation
  target: JobTarget;
  batchSize: number;
  delayMs: number;
  maxRequests: number;
  maxDurationMinutes: number;

  // Live execution state
  status: JobStatus;
  sent: number;
  statusCounts: Record<string, number>;
  first429At: number | null;
  latencies: number[]; // Capped at last ~200 entries
  lastTickAt: number;
  qstashScheduleId: string; // Message ID from QStash
  error?: string;
};

export type JobSafeStatus = {
  id: string;
  createdAt: number;
  status: JobStatus;
  sent: number;
  maxRequests: number;
  maxDurationMinutes: number;
  batchSize: number;
  delayMs: number;
  statusCounts: Record<string, number>;
  first429At: number | null;
  latencies: number[];
  lastTickAt: number;
  targetUrl: string;
  targetMethod: string;
  error?: string;
  avgLatency: number | null;
  minLatency: number | null;
  maxLatency: number | null;
};

export type CreateJobPayload = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  batchSize?: number;
  delayMs?: number;
  maxRequests: number;
  maxDurationMinutes: number;
};

// Hard ceilings and guardrails
export const GUARDRAILS = {
  MAX_REQUESTS_CEILING: 1000000,
  MIN_REQUESTS: 1,
  MAX_DURATION_MINUTES_CEILING: 120,
  MIN_DURATION_MINUTES: 1,
  MAX_BATCH_SIZE_CEILING: 500,
  MIN_BATCH_SIZE: 1,
  DEFAULT_BATCH_SIZE: 5,
  MIN_DELAY_MS: 100,
  MAX_DELAY_MS: 60000,
  DEFAULT_DELAY_MS: 1000,
  MAX_LATENCY_HISTORY: 200,
  DEFAULT_JOB_TTL_SECONDS: 86400, // 24 hours
} as const;
