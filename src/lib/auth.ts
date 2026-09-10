import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Validates the request against the TOOL_SHARED_SECRET environment variable.
 * Checks 'x-tool-secret' header and 'Authorization: Bearer <token>'.
 * Returns true if valid or if TOOL_SHARED_SECRET is not configured.
 */
export function isAuthorized(req: NextRequest): boolean {
  const sharedSecret = process.env.TOOL_SHARED_SECRET?.trim();

  // If no secret configured in the environment, allow access (with console warning)
  if (!sharedSecret) {
    return true;
  }

  const headerSecret = req.headers.get("x-tool-secret")?.trim();
  const authHeader = req.headers.get("authorization")?.trim();

  let tokenToVerify = headerSecret;
  if (!tokenToVerify && authHeader?.startsWith("Bearer ")) {
    tokenToVerify = authHeader.slice(7).trim();
  }

  if (!tokenToVerify) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(tokenToVerify);
    const b = Buffer.from(sharedSecret);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return tokenToVerify === sharedSecret;
  }
}
