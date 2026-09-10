import { JobTarget } from "./types";

export type BatchResultItem = {
  status: string; // e.g. "200", "429", "ERR"
  statusCode: number | null;
  latencyMs: number;
  isRateLimited?: boolean;
  error?: string;
};

export type BatchExecutionResult = {
  items: BatchResultItem[];
  has429: boolean;
};

type CsrfSession = {
  token: string | null;
  cookieHeader: string;
};

/**
 * Universal CSRF and session cookie extractor.
 * Works across Laravel, Django, Rails, Spring, Express, and others.
 */
async function fetchCsrfSession(
  url: string,
  baseHeaders?: Record<string, string>
): Promise<CsrfSession | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": baseHeaders?.["User-Agent"] || "RateLimitTester/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(baseHeaders || {}),
      },
      cache: "no-store",
    });

    const rawCookies: string[] = (res.headers as any).getSetCookie
      ? (res.headers as any).getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);

    const cookieHeader = rawCookies
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    const html = await res.text();

    const tokenMatch =
      html.match(/name=["']_token["']\s+value=["']([^"']+)["']/i) ||
      html.match(/value=["']([^"']+)["']\s+name=["']_token["']/i) ||
      html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i) ||
      html.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i) || // Django
      html.match(/name=["']authenticity_token["']\s+value=["']([^"']+)["']/i); // Rails

    let token = tokenMatch ? tokenMatch[1] : null;

    if (!token && cookieHeader.includes("XSRF-TOKEN=")) {
      const match = cookieHeader.match(/XSRF-TOKEN=([^;]+)/);
      if (match) {
        try {
          token = decodeURIComponent(match[1]);
        } catch {
          token = match[1];
        }
      }
    }

    return {
      token,
      cookieHeader,
    };
  } catch (err) {
    console.warn(`[CSRF Fetcher] Failed to pre-fetch CSRF token from ${url}:`, err);
    return null;
  }
}

/**
 * Fires a single request to the target and measures roundtrip latency.
 * Implements:
 * - Option 2: Automatic X-Requested-With / Expect JSON headers
 * - Option 3: Rate-limit headers check on all status codes (including 302/200)
 * - Option 1: Redirect session inspection for flashed throttle error messages
 */
async function executeSingleRequest(
  target: JobTarget,
  overrideHeaders?: Record<string, string>,
  overrideBody?: string,
  timeoutMs: number = 10000
): Promise<BatchResultItem> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const headers: Record<string, string> = {
      ...(target.headers || {}),
      ...(overrideHeaders || {}),
    };

    // Option 2: Send AJAX headers so framework exception handlers return a 429 JSON response instead of redirecting
    if (target.expectJson !== false) {
      if (!Object.keys(headers).some((k) => k.toLowerCase() === "x-requested-with")) {
        headers["X-Requested-With"] = "XMLHttpRequest";
      }
      if (!Object.keys(headers).some((k) => k.toLowerCase() === "accept")) {
        headers["Accept"] = "application/json, text/plain, */*";
      }
    }

    const finalBody = overrideBody !== undefined ? overrideBody : target.body;

    // If body exists and no content-type is provided, infer default
    if (finalBody && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      if (finalBody.trim().startsWith("{") || finalBody.trim().startsWith("[")) {
        headers["Content-Type"] = "application/json";
      } else {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }

    const response = await fetch(target.url, {
      method: target.method || "GET",
      headers,
      body: ["GET", "HEAD"].includes((target.method || "GET").toUpperCase())
        ? undefined
        : finalBody,
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual", // Prevent automatic redirect so response headers and locations can be inspected
    });

    const latencyMs = Math.round(performance.now() - start);

    // Option 3: Check rate-limit headers on the response (even if status is 302 or 200)
    const retryAfter = response.headers.get("retry-after");
    const remaining =
      response.headers.get("x-ratelimit-remaining") ||
      response.headers.get("ratelimit-remaining");
    const isHeaderThrottled = (retryAfter !== null && retryAfter !== "") || remaining === "0";

    // Direct 429 or throttled by response headers
    if (response.status === 429 || isHeaderThrottled) {
      return {
        status: "429",
        statusCode: 429,
        latencyMs,
        isRateLimited: true,
        error: isHeaderThrottled && response.status !== 429 ? `Throttled via headers (HTTP ${response.status})` : undefined,
      };
    }

    // Option 1: Follow redirect and check flashed session error message
    if ([301, 302, 303, 307, 308].includes(response.status) && target.followRedirects) {
      const location = response.headers.get("location");
      if (location) {
        try {
          const redirectUrl = new URL(location, target.url).toString();
          const redirectCookies: string[] = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie()
            : [response.headers.get("set-cookie")].filter(Boolean);
          const redirectCookieHeader = redirectCookies.map((c: string) => c.split(";")[0].trim()).join("; ");
          const mergedCookies = [headers["Cookie"], redirectCookieHeader].filter(Boolean).join("; ");

          const followRes = await fetch(redirectUrl, {
            method: "GET",
            headers: {
              "User-Agent": headers["User-Agent"] || "RateLimitTester/1.0",
              ...(mergedCookies ? { Cookie: mergedCookies } : {}),
            },
            cache: "no-store",
          });

          const followHtml = await followRes.text();
          const throttlePatterns = [
            /too many (login )?attempts/i,
            /please try again in \d+/i,
            /rate limit exceeded/i,
            /too many requests/i,
            /throttle/i,
            /temporarily locked/i,
            /account locked/i,
            /slow down/i,
          ];

          if (throttlePatterns.some((p) => p.test(followHtml))) {
            return {
              status: "429",
              statusCode: 429,
              latencyMs,
              isRateLimited: true,
              error: "Throttled (flashed error message detected in redirect session)",
            };
          }
        } catch (err: any) {
          console.warn("[Redirect Inspector] Could not inspect redirect target:", err.message);
        }
      }
    }

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
 * If autoCsrf is enabled, pre-fetches a CSRF token & session cookie first.
 */
export async function executeBatch(
  target: JobTarget,
  batchCount: number
): Promise<BatchExecutionResult> {
  let dynamicHeaders: Record<string, string> | undefined;
  let dynamicBody: string | undefined;

  // Auto-fetch CSRF token and session cookie if requested
  if (target.autoCsrf && !["GET", "HEAD"].includes((target.method || "GET").toUpperCase())) {
    const csrfPageUrl = target.csrfUrl || target.url;
    const session = await fetchCsrfSession(csrfPageUrl, target.headers);

    if (session) {
      dynamicHeaders = {};

      if (session.cookieHeader) {
        // Merge cookies
        const existingCookie = target.headers?.["Cookie"] || target.headers?.["cookie"] || "";
        dynamicHeaders["Cookie"] = existingCookie
          ? `${existingCookie}; ${session.cookieHeader}`
          : session.cookieHeader;
      }

      if (session.token) {
        dynamicHeaders["X-CSRF-TOKEN"] = session.token;
        dynamicHeaders["X-XSRF-TOKEN"] = session.token;
        dynamicHeaders["X-CSRFToken"] = session.token; // Django header

        // Inject token into body
        if (target.body) {
          const trimmed = target.body.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (typeof parsed === "object" && parsed !== null && !parsed._token) {
                parsed._token = session.token;
                dynamicBody = JSON.stringify(parsed);
              }
            } catch {}
          } else if (!trimmed.includes("_token=") && !trimmed.includes("csrfmiddlewaretoken=")) {
            dynamicBody = `${trimmed}${trimmed ? "&" : ""}_token=${encodeURIComponent(session.token)}`;
          }
        } else {
          dynamicBody = `_token=${encodeURIComponent(session.token)}`;
        }
      }
    }
  }

  const promises: Promise<BatchResultItem>[] = [];

  for (let i = 0; i < batchCount; i++) {
    promises.push(executeSingleRequest(target, dynamicHeaders, dynamicBody));
  }

  const results = await Promise.all(promises);
  const has429 = results.some((r) => r.statusCode === 429 || r.isRateLimited);

  return {
    items: results,
    has429,
  };
}
