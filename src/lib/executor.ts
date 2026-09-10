import { JobTarget } from "./types";

export type BatchResultItem = {
  status: string; // e.g. "200", "429", "ERR"
  statusCode: number | null;
  latencyMs: number;
  error?: string;
};

export type BatchExecutionResult = {
  items: BatchResultItem[];
  has429: boolean;
};

/**
 * Fires a single request to the target and measures roundtrip latency.
 */
async function executeSingleRequest(
  target: JobTarget,
  timeoutMs: number = 10000
): Promise<BatchResultItem> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const headers: Record<string, string> = {
      ...(target.headers || {}),
    };

    // If body exists and no content-type is provided, default to JSON
    if (target.body && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(target.url, {
      method: target.method || "GET",
      headers,
      body: ["GET", "HEAD"].includes((target.method || "GET").toUpperCase())
        ? undefined
        : target.body,
      signal: controller.signal,
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - start);
    return {
      status: String(response.status),
      statusCode: response.status,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    const isAbort = err.name === "AbortError";
    const errorMsg = isAbort ? "Timeout" : err.message || "Network error";

    return {
      status: "ERR",
      statusCode: null,
      latencyMs,
      error: errorMsg,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a batch of requests in parallel against the target endpoint.
 */
export async function executeBatch(
  target: JobTarget,
  batchCount: number
): Promise<BatchExecutionResult> {
  const promises: Promise<BatchResultItem>[] = [];

  for (let i = 0; i < batchCount; i++) {
    promises.push(executeSingleRequest(target));
  }

  const results = await Promise.all(promises);
  const has429 = results.some((r) => r.statusCode === 429);

  return {
    items: results,
    has429,
  };
}
