"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, ShieldAlert, Sparkles, Play, Code, Clock, Zap, BookOpen, Info, Shield, KeyRound } from "lucide-react";
import { GUARDRAILS } from "@/lib/types";

interface HeaderItem {
  id: string;
  key: string;
  value: string;
}

interface ConfigFormProps {
  onJobStarted: (jobId: string) => void;
  sharedSecret: string;
  setSharedSecret: (secret: string) => void;
  onOpenGuide?: () => void;
}

export function ConfigForm({ onJobStarted, sharedSecret, setSharedSecret, onOpenGuide }: ConfigFormProps) {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState<HeaderItem[]>([]);
  const [body, setBody] = useState("");
  const [batchSize, setBatchSize] = useState<number>(5);
  const [delayMs, setDelayMs] = useState<number>(1000);
  const [maxRequests, setMaxRequests] = useState<number>(100);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number>(5);
  const [autoCsrf, setAutoCsrf] = useState<boolean>(false);
  const [csrfUrl, setCsrfUrl] = useState<string>("");
  const [expectJson, setExpectJson] = useState<boolean>(true);
  const [followRedirects, setFollowRedirects] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Preset loader
  const loadPreset = (type: "mock" | "api" | "web" | "get") => {
    setFormError(null);
    if (type === "mock") {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      setUrl(`${origin}/api/mock-target?limit=25&window=60`);
      setMethod("GET");
      setHeaders([]);
      setBody("");
      setBatchSize(5);
      setDelayMs(500);
      setMaxRequests(60);
      setMaxDurationMinutes(3);
      setAutoCsrf(false);
      setCsrfUrl("");
      setExpectJson(false);
      setFollowRedirects(false);
    } else if (type === "web") {
      setUrl("https://example.com/login");
      setMethod("POST");
      setHeaders([
        { id: "h-1", key: "Content-Type", value: "application/x-www-form-urlencoded" },
      ]);
      setBody("email=user%40example.com&password=wrong_password_test");
      setBatchSize(5);
      setDelayMs(1000);
      setMaxRequests(50);
      setMaxDurationMinutes(5);
      setAutoCsrf(true);
      setCsrfUrl("");
      setExpectJson(true);
      setFollowRedirects(true);
    } else if (type === "api") {
      setUrl("https://api.example.com/v1/auth/login");
      setMethod("POST");
      setHeaders([
        { id: "h-1", key: "Content-Type", value: "application/json" },
        { id: "h-2", key: "Accept", value: "application/json" },
      ]);
      setBody(
        JSON.stringify(
          {
            email: "user@example.com",
            password: "wrong_password_test",
          },
          null,
          2
        )
      );
      setBatchSize(5);
      setDelayMs(1000);
      setMaxRequests(50);
      setMaxDurationMinutes(5);
      setAutoCsrf(false);
      setCsrfUrl("");
      setExpectJson(true);
      setFollowRedirects(false);
    } else {
      setUrl("https://httpbin.org/get");
      setMethod("GET");
      setHeaders([]);
      setBody("");
      setBatchSize(2);
      setDelayMs(1000);
      setMaxRequests(20);
      setMaxDurationMinutes(2);
      setAutoCsrf(false);
      setCsrfUrl("");
      setExpectJson(false);
      setFollowRedirects(false);
    }
  };

  const addHeader = () => {
    setHeaders((prev) => [
      ...prev,
      { id: `hdr_${Date.now()}_${Math.random()}`, key: "", value: "" },
    ]);
  };

  const removeHeader = (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHeader = (id: string, field: "key" | "value", value: string) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validations
    if (!url.trim()) {
      setFormError("Target URL is required.");
      return;
    }

    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setFormError("Target URL must start with http:// or https://");
        return;
      }
    } catch {
      setFormError("Target URL is invalid.");
      return;
    }

    if (!maxRequests || maxRequests < GUARDRAILS.MIN_REQUESTS) {
      setFormError(`Max requests must be at least ${GUARDRAILS.MIN_REQUESTS}.`);
      return;
    }
    if (maxRequests > GUARDRAILS.MAX_REQUESTS_CEILING) {
      setFormError(
        `Max requests cannot exceed ceiling of ${GUARDRAILS.MAX_REQUESTS_CEILING.toLocaleString()}.`
      );
      return;
    }

    if (!maxDurationMinutes || maxDurationMinutes < GUARDRAILS.MIN_DURATION_MINUTES) {
      setFormError(`Max duration must be at least ${GUARDRAILS.MIN_DURATION_MINUTES} minute.`);
      return;
    }
    if (maxDurationMinutes > GUARDRAILS.MAX_DURATION_MINUTES_CEILING) {
      setFormError(
        `Max duration cannot exceed ceiling of ${GUARDRAILS.MAX_DURATION_MINUTES_CEILING} minutes.`
      );
      return;
    }

    // Assemble headers record
    const headersRecord: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim()) {
        headersRecord[h.key.trim()] = h.value;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sharedSecret.trim() ? { "x-tool-secret": sharedSecret.trim() } : {}),
        },
        body: JSON.stringify({
          url: url.trim(),
          method,
          headers: headersRecord,
          body: body.trim() || undefined,
          batchSize: Number(batchSize),
          delayMs: Number(delayMs),
          maxRequests: Number(maxRequests),
          maxDurationMinutes: Number(maxDurationMinutes),
          autoCsrf,
          csrfUrl: csrfUrl.trim() || undefined,
          expectJson,
          followRedirects,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to initialize test`);
      }

      onJobStarted(data.id);
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred while starting the job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            Configure Load Test
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Server-side batch execution driven by QStash scheduler with strict guardrails
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Presets:</span>
          <button
            type="button"
            onClick={() => loadPreset("mock")}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 transition"
          >
            Built-in Mock (429 at #25)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("web")}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900 transition flex items-center gap-1"
          >
            <KeyRound className="w-3 h-3" /> Web Form (+CSRF)
          </button>
          <button
            type="button"
            onClick={() => loadPreset("api")}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
          >
            API JSON Endpoint
          </button>
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-900/40 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-800/60 flex items-center gap-1 transition"
            >
              <BookOpen className="w-3.5 h-3.5" /> User Guide
            </button>
          )}
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-3.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Configuration Error:</strong> {formError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL and Method */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Target Endpoint <span className="text-rose-400">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
              <option value="HEAD">HEAD</option>
            </select>
            <input
              type="text"
              required
              placeholder="https://api.yourdomain.com/login"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Custom Headers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              HTTP Headers
            </label>
            <button
              type="button"
              onClick={addHeader}
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Header
            </button>
          </div>

          {headers.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">
              No custom headers added. Target will use standard HTTP defaults.
            </div>
          ) : (
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Header Key (e.g. Authorization)"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, "key", e.target.value)}
                    className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Bearer token123)"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, "value", e.target.value)}
                    className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(h.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Request Body (for POST/PUT/PATCH) */}
        {method !== "GET" && method !== "HEAD" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Payload Body (JSON or raw string)
              </label>
              {body.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      setBody(JSON.stringify(JSON.parse(body), null, 2));
                    } catch {}
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <Code className="w-3 h-3" /> Format JSON
                </button>
              )}
            </div>
            <textarea
              rows={4}
              placeholder='{"username": "test", "password": "password"}'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* CSRF & Session Pre-fetch (For Laravel / Django / Rails web forms) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoCsrf"
              checked={autoCsrf}
              onChange={(e) => setAutoCsrf(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            <label htmlFor="autoCsrf" className="cursor-pointer">
              <span className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                Auto-fetch CSRF Token & Session Cookie (for Laravel / Web Forms)
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Pre-fetches the page before each batch to capture <code>_token</code> and session cookies, injecting them into requests to bypass HTTP 419 Page Expired errors.
              </span>
            </label>
          </div>

          {autoCsrf && (
            <div className="pt-2 pl-7 space-y-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-semibold text-slate-400">
                Custom CSRF Source URL (optional, defaults to Target URL)
              </label>
              <input
                type="text"
                placeholder="https://example.com/login (defaults to target URL)"
                value={csrfUrl}
                onChange={(e) => setCsrfUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          )}
        </div>

        {/* 302 Detection Options */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Rate-Limit Detection Mode (for 302 redirect targets)
          </p>

          {/* expectJson toggle */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="expectJson"
              checked={expectJson}
              onChange={(e) => setExpectJson(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            <label htmlFor="expectJson" className="cursor-pointer">
              <span className="block text-xs font-bold text-slate-200">
                Send AJAX Headers — get clean HTTP 429 instead of 302 redirects
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Injects <code>X-Requested-With: XMLHttpRequest</code> and <code>Accept: application/json</code>. Laravel, Rails, Django and most frameworks will respond with a real <code>429</code> JSON body instead of a redirect when the rate limiter fires. Recommended for web-form targets.
              </span>
            </label>
          </div>

          {/* followRedirects toggle */}
          <div className="flex items-start gap-3 pt-2 border-t border-slate-800/60">
            <input
              type="checkbox"
              id="followRedirects"
              checked={followRedirects}
              onChange={(e) => setFollowRedirects(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            <label htmlFor="followRedirects" className="cursor-pointer">
              <span className="block text-xs font-bold text-slate-200">
                Follow 302 Redirects — inspect flashed session messages
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                After a redirect, re-requests the destination with the session cookie and scans the HTML body for throttle phrases like <em>"Too many login attempts"</em>. Marks those responses as rate-limited even though the status code was 302.
              </span>
            </label>
          </div>
        </div>

        {/* API Route vs Web Form Tip */}
        <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-indigo-200 font-semibold">Testing API Routes vs Web Forms:</strong> If your backend has an API endpoint (e.g. in <code>routes/api.php</code> such as <code>/api/login</code>), testing the API route is cleaner because API routes do not require CSRF tokens and hit your rate limiter (<code>throttle:api</code>) directly!
          </div>
        </div>

        {/* Pacing & Batch Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Batch Size (requests per tick)
            </label>
            <div className="relative">
              <input
                type="number"
                min={GUARDRAILS.MIN_BATCH_SIZE}
                max={GUARDRAILS.MAX_BATCH_SIZE_CEILING}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                reqs/batch
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cap: {GUARDRAILS.MAX_BATCH_SIZE_CEILING} requests per tick
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Delay Between Batches
            </label>
            <div className="relative">
              <input
                type="number"
                min={GUARDRAILS.MIN_DELAY_MS}
                max={GUARDRAILS.MAX_DELAY_MS}
                step={100}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                ms
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {(delayMs / 1000).toFixed(1)}s interval (QStash delay)
            </p>
          </div>
        </div>

        {/* Hard Guardrails: Max Requests & Max Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1">
              Max Total Requests <span className="text-rose-400">* Required</span>
            </label>
            <input
              type="number"
              required
              min={GUARDRAILS.MIN_REQUESTS}
              max={GUARDRAILS.MAX_REQUESTS_CEILING}
              value={maxRequests}
              onChange={(e) => setMaxRequests(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Hard ceiling: {GUARDRAILS.MAX_REQUESTS_CEILING.toLocaleString()} requests
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1">
              Max Duration <span className="text-rose-400">* Required</span>
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min={GUARDRAILS.MIN_DURATION_MINUTES}
                max={GUARDRAILS.MAX_DURATION_MINUTES_CEILING}
                value={maxDurationMinutes}
                onChange={(e) => setMaxDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                minutes
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Hard ceiling: {GUARDRAILS.MAX_DURATION_MINUTES_CEILING} minutes
            </p>
          </div>
        </div>

        {/* Shared Secret Authorization */}
        <div className="pt-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
            Tool Shared Secret (Optional in dev, required if TOOL_SHARED_SECRET is set)
          </label>
          <input
            type="password"
            placeholder="Shared secret token..."
            value={sharedSecret}
            onChange={(e) => setSharedSecret(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Initializing Job on Scheduler...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              Start Load & Rate Limit Test
            </>
          )}
        </button>
      </form>
    </div>
  );
}
