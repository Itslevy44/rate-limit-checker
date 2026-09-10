import { Client, Receiver } from "@upstash/qstash";
import { NextRequest } from "next/server";

const localTimers = new Map<string, NodeJS.Timeout>();

function getQStashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token || token.includes("ey...") || token === "your-qstash-token") {
    return null;
  }
  const baseUrl = process.env.QSTASH_URL?.trim();
  return new Client({
    token,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

function getQStashReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (
    !currentSigningKey ||
    currentSigningKey.includes("sig_...") ||
    !nextSigningKey ||
    nextSigningKey.includes("sig_...")
  ) {
    return null;
  }

  return new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
}

/**
 * Schedules the next execution tick for the given job.
 * If QStash credentials are configured, publishes a delayed message via QStash API.
 * Otherwise, falls back to an in-process local timer for seamless development.
 */
export async function scheduleTick(
  jobId: string,
  delayMs: number,
  baseUrl: string
): Promise<string> {
  const client = getQStashClient();
  const tickUrl = `${baseUrl.replace(/\/$/, "")}/api/job/${jobId}/tick`;

  if (client) {
    // QStash accepts delay in seconds or human format
    const delaySeconds = Math.max(1, Math.round(delayMs / 1000));
    try {
      const response = await client.publishJSON({
        url: tickUrl,
        body: { jobId },
        delay: delaySeconds,
      });
      return response.messageId;
    } catch (err: any) {
      console.error(`[QStash] Failed to publish delayed message for job ${jobId}:`, err);
      throw new Error(`Failed to schedule QStash tick: ${err.message}`);
    }
  }

  // Local development fallback: schedule a tick using in-memory timer
  const localTimerId = `local_msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const timer = setTimeout(async () => {
    localTimers.delete(localTimerId);
    try {
      await fetch(tickUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-local-simulated-tick": "true",
        },
        body: JSON.stringify({ jobId }),
      });
    } catch (err) {
      console.error(`[LocalScheduler] Error triggering tick for job ${jobId}:`, err);
    }
  }, Math.max(50, delayMs));

  localTimers.set(localTimerId, timer);
  return localTimerId;
}

/**
 * Cancels a pending scheduled tick by message ID.
 */
export async function cancelTick(messageId: string): Promise<boolean> {
  if (!messageId) return false;

  // Check if it's a local fallback timer
  if (localTimers.has(messageId)) {
    clearTimeout(localTimers.get(messageId));
    localTimers.delete(messageId);
    return true;
  }

  const client = getQStashClient();
  if (client) {
    try {
      await client.messages.delete(messageId);
      return true;
    } catch (err: any) {
      console.warn(`[QStash] Message ${messageId} could not be canceled (may have already fired):`, err.message);
      return false;
    }
  }

  return false;
}

/**
 * Verifies that the incoming /tick request originated from Upstash QStash.
 * Returns true if valid, or if running in local simulation mode.
 */
export async function verifyTickSignature(
  req: NextRequest,
  rawBody: string
): Promise<boolean> {
  const receiver = getQStashReceiver();

  // If no QStash keys are set, allow local simulation headers or development mode
  if (!receiver) {
    const isLocalSimulated = req.headers.get("x-local-simulated-tick") === "true";
    if (isLocalSimulated || process.env.NODE_ENV === "development") {
      return true;
    }
    // If not in development and no receiver configured, warn and allow only if explicitly permitted
    console.warn("[QStash] Signature verification skipped because QStash keys are not configured.");
    return true;
  }

  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    return false;
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body: rawBody,
      url: req.url,
    });
    return isValid;
  } catch (err) {
    console.error("[QStash] Signature verification failed:", err);
    return false;
  }
}
