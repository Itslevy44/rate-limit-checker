import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`\n=== Starting End-to-End Verification against ${BASE_URL} ===\n`);

  // 1. Verify Mock Target Rate Limiting directly
  console.log("1. Testing built-in mock target rate limiting behavior...");
  await fetch(`${BASE_URL}/api/mock-target?reset=true`);

  const res1 = await fetch(`${BASE_URL}/api/mock-target?limit=3&window=60`);
  assert.equal(res1.status, 200, "First request to mock target should be 200");
  const d1 = await res1.json();
  assert.equal(d1.status, "ok");

  const res2 = await fetch(`${BASE_URL}/api/mock-target?limit=3&window=60`);
  assert.equal(res2.status, 200, "Second request should be 200");

  const res3 = await fetch(`${BASE_URL}/api/mock-target?limit=3&window=60`);
  assert.equal(res3.status, 200, "Third request should be 200");

  const res4 = await fetch(`${BASE_URL}/api/mock-target?limit=3&window=60`);
  assert.equal(res4.status, 429, "Fourth request should be 429 (rate limited)");
  const d4 = await res4.json();
  assert.equal(d4.error, "Too Many Requests");
  console.log("   ✓ Mock target properly returns 200 up to limit and 429 beyond limit");

  // 2. Test Guardrail Validations on POST /api/job
  console.log("\n2. Testing guardrail validations on POST /api/job...");

  // Missing URL
  const g1 = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxRequests: 50, maxDurationMinutes: 5 }),
  });
  assert.equal(g1.status, 400);
  console.log("   ✓ Missing URL correctly rejected (400)");

  // Missing maxRequests
  const g2 = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", maxDurationMinutes: 5 }),
  });
  assert.equal(g2.status, 400);
  console.log("   ✓ Missing maxRequests correctly rejected (400)");

  // maxRequests exceeding 50,000 ceiling
  const g3 = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", maxRequests: 99999, maxDurationMinutes: 5 }),
  });
  assert.equal(g3.status, 400);
  const d_g3 = await g3.json();
  assert.match(d_g3.error, /exceeds maximum ceiling/i);
  console.log("   ✓ maxRequests > 50,000 ceiling correctly rejected (400)");

  // maxDurationMinutes exceeding 120 ceiling
  const g4 = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", maxRequests: 100, maxDurationMinutes: 300 }),
  });
  assert.equal(g4.status, 400);
  console.log("   ✓ maxDurationMinutes > 120 ceiling correctly rejected (400)");

  // 3. Create a real job and test execution loop
  console.log("\n3. Testing complete job lifecycle: create -> tick batches -> detect 429 -> complete...");
  const rReset = await (await fetch(`${BASE_URL}/api/mock-target?reset=true`)).json();
  console.log("   Mock target reset status:", rReset);

  const createRes = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${BASE_URL}/api/mock-target?limit=4`,
      method: "GET",
      batchSize: 3,
      delayMs: 200,
      maxRequests: 9,
      maxDurationMinutes: 2,
    }),
  });

  assert.equal(createRes.status, 200, "Job creation should succeed with 200");
  const createdJob = await createRes.json();
  assert.ok(createdJob.id, "Job ID must be returned");
  assert.equal(createdJob.status, "running");
  console.log(`   ✓ Job created successfully: ID=${createdJob.id}`);

  // Poll status endpoint
  let finalStatus = null;
  for (let i = 0; i < 25; i++) {
    await sleep(400);
    const statRes = await fetch(`${BASE_URL}/api/job/${createdJob.id}/status`);
    assert.equal(statRes.status, 200);
    finalStatus = await statRes.json();
    console.log(`   [Poll #${i + 1}] Status=${finalStatus.status} Sent=${finalStatus.sent}/${finalStatus.maxRequests} Statuses=${JSON.stringify(finalStatus.statusCounts)} First429At=${finalStatus.first429At}`);

    if (finalStatus.status === "completed") {
      break;
    }
  }

  assert.equal(finalStatus.status, "completed", "Job should reach completed status");
  assert.equal(finalStatus.sent, 9, "Total sent should equal maxRequests");
  assert.ok(finalStatus.first429At !== null, "First 429 request index should be recorded");
  assert.ok(
    finalStatus.first429At >= 4 && finalStatus.first429At <= 6,
    `First 429 index (${finalStatus.first429At}) should occur within crossing batch 2 (requests 4..6)`
  );
  assert.ok(finalStatus.latencies.length > 0, "Latencies must be recorded");
  assert.ok(finalStatus.avgLatency > 0, "Average latency must be computed");
  console.log("   ✓ Job completed full lifecycle with exact first-429 detection and latencies!");

  // 4. Test STOP CONTROL
  console.log("\n4. Testing STOP CONTROL end-to-end...");
  const stopJobCreate = await fetch(`${BASE_URL}/api/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${BASE_URL}/api/mock-target?limit=50`,
      method: "GET",
      batchSize: 2,
      delayMs: 400,
      maxRequests: 30,
      maxDurationMinutes: 2,
    }),
  });

  const stopJob = await stopJobCreate.json();
  console.log(`   ✓ New test job created: ID=${stopJob.id}`);

  // Wait for 1-2 ticks
  await sleep(700);

  // Send STOP command
  console.log("   -> Triggering POST /stop...");
  const stopRes = await fetch(`${BASE_URL}/api/job/${stopJob.id}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  assert.equal(stopRes.status, 200, "Stop endpoint must return 200");
  const stopData = await stopRes.json();
  assert.equal(stopData.status, "stopped", "Job status must be updated to stopped");

  // Read status immediately
  const statusAtStopRes = await fetch(`${BASE_URL}/api/job/${stopJob.id}/status`);
  const statusAtStop = await statusAtStopRes.json();
  const sentAtStop = statusAtStop.sent;
  console.log(`   ✓ Stop registered at sent=${sentAtStop}`);

  // Wait another 1.5 seconds to confirm sent count NEVER increases
  await sleep(1500);
  const statusAfterWaitRes = await fetch(`${BASE_URL}/api/job/${stopJob.id}/status`);
  const statusAfterWait = await statusAfterWaitRes.json();
  console.log(`   ✓ Status after wait: sent=${statusAfterWait.sent} (was ${sentAtStop})`);
  assert.equal(statusAfterWait.sent, sentAtStop, "Requests sent MUST NOT increase after job is stopped!");
  assert.equal(statusAfterWait.status, "stopped");
  console.log("   ✓ Verified: Stop control reliably halts execution!");

  console.log("\n=== ALL END-TO-END VERIFICATION CHECKS PASSED! ===\n");
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
