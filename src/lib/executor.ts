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

type CsrfSession = {
  token: string | null;
  cookieHeader: string;
};

/**
 * Fetches the target page to extract:
 * 1. CSRF token (from HTML <input name="_token">, <meta name="csrf-token">, or XSRF-TOKEN cookie)
 * 2. Session cookies (from Set-Cookie headers)
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
      html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i);

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
      redirect: "manual", // Prevent automatic redirect so 302/301 responses are measured directly
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
          } else if (!trimmed.includes("_token=")) {
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
  const has429 = results.some((r) => r.statusCode === 429);

  return {
    items: results,
    has429,
  };
}
