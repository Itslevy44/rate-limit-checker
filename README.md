# Rate Limit Tester

A Vercel-hosted tool to load-test your own endpoints and observe rate-limiting behavior in real time, with server-side batch execution driven by Upstash QStash self-rescheduling ticks, Upstash Redis job store, and a reliable stop control.

---

## Architecture Overview

```
┌────────────┐   create job    ┌───────────────┐
│  Frontend  │ ───────────────▶│ POST /api/job │──┐
│  (form)    │                  └───────────────┘  │ writes job record
│            │◀── poll status ──┐                  ▼
│            │                  │            ┌─────────────┐
└────────────┘                  │            │ Upstash KV  │
      ▲                         │            │  (job store)│
      │ stop button             │            └─────────────┘
      ▼                         │                  ▲
┌───────────────┐               │                  │ read/write each tick
│ POST /api/job/ │              │            ┌─────────────┐
│  :id/stop      │              └────────────│ /api/job/:id │
└───────────────┘                            │   /tick      │
                                              └─────────────┘
                                                     ▲
                                                     │ triggered every N sec
                                              ┌─────────────┐
                                              │   QStash     │
                                              │  (scheduler) │
                                              └─────────────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │ Target URL   │
                                              │ (your login  │
                                              │  endpoint)   │
                                              └─────────────┘
```

### Why this design:
- **Stateless & Time-bounded**: Vercel serverless functions are stateless and time-limited. Rather than looping inside a single function, QStash triggers `/api/job/:id/tick` on a schedule.
- **Short-interval Batching**: Uses the QStash **self-rescheduling pattern** (publishing delayed messages) to support sub-minute and sub-second batch intervals.
- **Reliable Stop Control**: When `/stop` is called, it immediately flips the Redis job status to `"stopped"` and deletes pending QStash messages by ID. Each tick checks `status === "running"` before firing any requests, guaranteeing that stopped jobs halt immediately.
- **Auto-expiring Records**: Redis keys expire after 24 hours (`EXPIRE 86400`) to prevent data bloat.

---

## Guardrails Built-in

- [x] **Required Hard Ceilings**: `maxRequests` (max 1,000,000 requests) and `batchSize` (up to 500 reqs/tick), with `maxDurationMinutes` (max 120m) strictly required and capped server-side.
- [x] **Built-in Interactive User Guide**: Comprehensive 3-step walkthrough and tuning recommendations directly in the web app.
- [x] **Pre-Execution Stop Check**: `/tick` verifies `status === "running"` before firing any batch requests.
- [x] **QStash Webhook Signature Verification**: Uses `@upstash/qstash` `Receiver` to cryptographically verify incoming ticks.
- [x] **Shared Secret Auth**: All API routes and frontend actions can be protected by `TOOL_SHARED_SECRET` via `x-tool-secret` or `Authorization: Bearer`.
- [x] **Capped Latency Sparkline**: Rolling array of last 200 latencies prevents Redis record bloat.
- [x] **Durable Logging**: Logs job creation, 429 detections, stop events, and completion summaries.
- [x] **Built-in Mock Target**: `/api/mock-target` allows testing rate limiting immediately without external endpoints.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx=

# Upstash QStash Configuration
QSTASH_TOKEN=ey...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Base URL for QStash webhook delivery
# Production on Vercel: https://your-project.vercel.app
# Local development: http://localhost:3000 (or ngrok URL for remote QStash webhooks)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Shared secret gating the UI and API routes
TOOL_SHARED_SECRET=your-shared-secret-here
```

*(Note: In local development without cloud credentials, the application automatically falls back to an in-memory Redis store and local scheduler so you can test immediately!)*

---

## Quick Start & Development

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## Running Tests

```bash
# Run unit & guardrail tests
npm test

# Run end-to-end integration test (tests mock-target, creation, tick execution, first-429 detection, and stop control)
npm run test:e2e
```

---

## Deploying to Vercel

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the project in Vercel.
3. Configure the environment variables in your Vercel Project Settings:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
   - `TOOL_SHARED_SECRET`
   - `NEXT_PUBLIC_BASE_URL` (set to your Vercel production URL, e.g. `https://rate-limiter-checker.vercel.app`)
4. Deploy!
