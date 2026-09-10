import { NextRequest, NextResponse } from "next/server";

// In-memory counter for mock rate-limiting simulation
let requestCounter = 0;
let lastReset = Date.now();

export async function GET(req: NextRequest) {
  return handleMockRequest(req);
}

export async function POST(req: NextRequest) {
  return handleMockRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleMockRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleMockRequest(req);
}

async function handleMockRequest(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Optional query parameters to customize simulation
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const resetAfterSeconds = parseInt(searchParams.get("window") || "60", 10);
  const latencyMs = parseInt(searchParams.get("delay") || "20", 10);
  const shouldReset = searchParams.get("reset") === "true";

  const now = Date.now();
  if (shouldReset || now - lastReset > resetAfterSeconds * 1000) {
    requestCounter = 0;
    lastReset = now;
    if (shouldReset) {
      return NextResponse.json({ status: "reset", message: "Counter reset to 0" });
    }
  }

  requestCounter++;
  console.log(`[MockTarget] #${requestCounter} method=${req.method} url=${req.url}`);

  // Artificial latency simulation
  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
  }

  if (requestCounter > limit) {
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: `Rate limit of ${limit} requests per ${resetAfterSeconds}s exceeded.`,
        currentCount: requestCounter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(resetAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((lastReset + resetAfterSeconds * 1000) / 1000)),
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      message: "Request succeeded",
      currentCount: requestCounter,
      remaining: limit - requestCounter,
    },
    {
      status: 200,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(limit - requestCounter),
      },
    }
  );
}
