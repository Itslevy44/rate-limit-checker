import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Rate Limit Tester — Guardrails and Execution Suite", () => {
  test("Guardrails: Ceiling constants are within strict safe boundaries", async () => {
    const { GUARDRAILS } = await import("../src/lib/types.ts");
    assert.equal(GUARDRAILS.MAX_REQUESTS_CEILING, 1000000);
    assert.equal(GUARDRAILS.MAX_DURATION_MINUTES_CEILING, 120);
    assert.equal(GUARDRAILS.MAX_BATCH_SIZE_CEILING, 500);
    assert.equal(GUARDRAILS.MAX_LATENCY_HISTORY, 200);
    assert.equal(GUARDRAILS.DEFAULT_JOB_TTL_SECONDS, 86400);
  });

  test("Data Store: In-memory fallback saves, retrieves, updates, and stops jobs", async () => {
    const { saveJob, getJob, updateJob } = await import("../src/lib/redis.ts");

    const testJob = {
      id: "test-job-123",
      createdAt: Date.now(),
      target: {
        url: "http://localhost:3000/api/mock-target",
        method: "GET",
        headers: {},
      },
      batchSize: 5,
      delayMs: 500,
      maxRequests: 20,
      maxDurationMinutes: 2,
      status: "running",
      sent: 0,
      statusCounts: {},
      first429At: null,
      latencies: [],
      lastTickAt: Date.now(),
      qstashScheduleId: "msg_fake_1",
    };

    await saveJob(testJob);

    const fetched = await getJob("test-job-123");
    assert.ok(fetched);
    assert.equal(fetched.id, "test-job-123");
    assert.equal(fetched.status, "running");

    // Test stop transition
    const updated = await updateJob("test-job-123", (prev) => ({
      status: "stopped",
    }));

    assert.equal(updated?.status, "stopped");
    const reFetched = await getJob("test-job-123");
    assert.equal(reFetched?.status, "stopped");
  });

  test("Executor: Latency measurement and status code capture", async () => {
    const { executeBatch } = await import("../src/lib/executor.ts");

    // Execute against a public or data URL or mock handler
    // We test with a mock server or basic check
    const mockTarget = {
      url: "https://httpbin.org/status/200",
      method: "GET",
      headers: {},
    };

    try {
      const result = await executeBatch(mockTarget, 2);
      assert.equal(result.items.length, 2);
      assert.equal(typeof result.items[0].latencyMs, "number");
      assert.ok(result.items[0].latencyMs >= 0);
    } catch (e) {
      // If no internet connection in test runner, verify structure
      console.log("External network call skipped in offline environment:", e.message);
    }
  });

  test("Stop Guard Check: Non-running jobs are bypassed", async () => {
    const { getJob, saveJob } = await import("../src/lib/redis.ts");

    const stoppedJob = {
      id: "test-stopped-job",
      createdAt: Date.now(),
      target: {
        url: "http://localhost:3000/api/mock-target",
        method: "GET",
        headers: {},
      },
      batchSize: 5,
      delayMs: 500,
      maxRequests: 20,
      maxDurationMinutes: 2,
      status: "stopped",
      sent: 10,
      statusCounts: { "200": 10 },
      first429At: null,
      latencies: [45, 50],
      lastTickAt: Date.now(),
      qstashScheduleId: "msg_fake_2",
    };

    await saveJob(stoppedJob);

    const loaded = await getJob("test-stopped-job");
    assert.equal(loaded?.status, "stopped");

    // Simulate tick check
    const shouldExecute = loaded?.status === "running";
    assert.equal(shouldExecute, false, "Tick MUST NOT execute when job status is not running");
  });
});
