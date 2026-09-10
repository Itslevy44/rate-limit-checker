"use client";

import React from "react";
import {
  BookOpen,
  Zap,
  ShieldCheck,
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Server,
  StopCircle,
  KeyRound,
} from "lucide-react";

interface UserGuideProps {
  onStartTest: () => void;
}

export function UserGuide({ onStartTest }: UserGuideProps) {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Card */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-800/50 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1.5 mb-4">
            <BookOpen className="w-3.5 h-3.5" /> User Manual & Best Practices
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How to Use the Rate Limit Tester
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
            A comprehensive guide to stress-testing endpoints, observing rate-limiting (HTTP 429) thresholds in real time, and tuning batch execution without serverless timeouts.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onStartTest}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              <Play className="w-4 h-4 fill-current" /> Go to Test Setup
            </button>
            <a
              href="#quick-start"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition"
            >
              Jump to Quick Start
            </a>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Start Steps */}
      <div id="quick-start" className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-400" />
          Quick Start in 3 Easy Steps
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative shadow-md">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-mono font-bold flex items-center justify-center text-sm mb-3 border border-indigo-500/30">
              1
            </div>
            <h4 className="text-sm font-bold text-white">Choose or Enter Target</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Enter your target URL (e.g. <code>https://api.yourdomain.com/login</code>) and method, or click the <strong className="text-slate-200">Built-in Mock</strong> preset to test the tool safely with zero risk.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative shadow-md">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-mono font-bold flex items-center justify-center text-sm mb-3 border border-indigo-500/30">
              2
            </div>
            <h4 className="text-sm font-bold text-white">Set Pacing & Guardrails</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Configure batch size (up to <strong>500 reqs/tick</strong>), interval delay, and your hard quota cap (up to <strong>1,000,000 requests</strong>).
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative shadow-md">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-mono font-bold flex items-center justify-center text-sm mb-3 border border-indigo-500/30">
              3
            </div>
            <h4 className="text-sm font-bold text-white">Start & Observe Live</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Watch real-time status code charts, rolling latency sparklines, and the <strong>First-429 marker</strong>. Feel free to close the tab—it keeps running in the cloud!
            </p>
          </div>
        </div>
      </div>

      {/* Core Features & Metrics Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          Understanding the Live Dashboard Metrics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <h4 className="text-sm font-bold text-slate-200">200 OK (Allowed)</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Requests that passed through without tripping any rate limiters. If 100% of requests are 200, the target has either no rate limiter, or the threshold is higher than the test load.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <h4 className="text-sm font-bold text-amber-300">429 Too Many Requests</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              HTTP 429 means your target server's rate limiter activated! The dashboard records the exact request index where this first occurred (e.g. <em>Request #25</em>).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-400" />
              <h4 className="text-sm font-bold text-indigo-300">Rolling Latency Sparkline</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plots network response times for the most recent 200 requests. Watch for latency spikes as concurrency increases—this reveals server queueing behavior.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400" />
              <h4 className="text-sm font-bold text-rose-300">5xx & Network Errors</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Indicates target server crashes, timeouts (default 10s timeout), or dropped connections. Useful for finding the point where the server breaks rather than gracefully throttling.
            </p>
          </div>
        </div>
      </div>

      {/* Field Reference Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          Configuration Parameters & Limits
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-sans">
                <th className="py-2.5 px-3">Field</th>
                <th className="py-2.5 px-3">Limit / Range</th>
                <th className="py-2.5 px-3">Default</th>
                <th className="py-2.5 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-indigo-300">Target URL</td>
                <td className="py-2.5 px-3 font-sans">HTTP / HTTPS</td>
                <td className="py-2.5 px-3 font-sans">Required</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Target endpoint to benchmark</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-indigo-300">Batch Size</td>
                <td className="py-2.5 px-3">1 – 500 reqs</td>
                <td className="py-2.5 px-3">5 reqs</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Number of requests fired in parallel on each tick</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-indigo-300">Delay Between Batches</td>
                <td className="py-2.5 px-3">100ms – 60,000ms</td>
                <td className="py-2.5 px-3">1,000ms</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Pacing interval between QStash scheduler ticks</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-amber-300">Max Total Requests</td>
                <td className="py-2.5 px-3 font-bold text-amber-300">1 – 1,000,000 reqs</td>
                <td className="py-2.5 px-3 font-sans">Required</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Hard cap: test auto-stops once this count is reached</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-amber-300">Max Duration</td>
                <td className="py-2.5 px-3 font-bold text-amber-300">1 – 120 minutes</td>
                <td className="py-2.5 px-3 font-sans">Required</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Auto-stop safety timer regardless of request count</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-slate-200">HTTP Headers</td>
                <td className="py-2.5 px-3 font-sans">Key-Value list</td>
                <td className="py-2.5 px-3 font-sans">None</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Custom headers like Authorization, Content-Type, cookies</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-slate-200">Tool Shared Secret</td>
                <td className="py-2.5 px-3 font-sans">String token</td>
                <td className="py-2.5 px-3 font-sans">Optional</td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Gates access when TOOL_SHARED_SECRET is configured</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pro Tips for Testing Rate Limiters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Pro Tips: How to Find Your Endpoint's Rate Limit
        </h3>

        <div className="space-y-3 text-xs sm:text-sm text-slate-300">
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="font-bold text-indigo-400 shrink-0">1.</span>
            <div>
              <strong className="text-white">Don't test static root pages (<code>/</code>):</strong> Root URLs are often cached at the CDN level (Cloudflare/Vercel) and won't hit your backend server. Test actual dynamic routes like <code>/api/auth/login</code>, <code>/api/search</code>, or <code>/api/data</code>.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="font-bold text-indigo-400 shrink-0">2.</span>
            <div>
              <strong className="text-white">To test burst rate limiters (Token Bucket):</strong> Set a high <strong>Batch Size</strong> (e.g. 20 to 50) and a short delay (e.g. 250ms–500ms). This sends sudden spikes of simultaneous requests to test if your burst capacity holds.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="font-bold text-indigo-400 shrink-0">3.</span>
            <div>
              <strong className="text-white">To test window rate limiters (Sliding Window):</strong> Set a moderate batch size (e.g. 5–10) with a consistent 1-second delay, but a higher <strong>Max Total Requests</strong> (e.g. 200–1000).
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="font-bold text-rose-400 shrink-0">4.</span>
            <div>
              <strong className="text-white">Instant Stop Guarantee:</strong> Clicking <strong className="text-rose-400">STOP TEST</strong> immediately flips the state in Redis and cancels pending messages in QStash. Subsequent ticks are rejected before firing any HTTP requests.
            </div>
          </div>
        </div>
      </div>

      {/* CSRF Tokens vs API Routes Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-emerald-400" />
          Handling CSRF Tokens vs. Testing API Routes
        </h3>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              1. Why Web Forms Return "HTTP 419 Page Expired"
            </h4>
            <p className="text-slate-400 leading-relaxed text-xs">
              Backend frameworks like <strong>Laravel, Django, and Ruby on Rails</strong> include CSRF (Cross-Site Request Forgery) protection on all web routes (e.g. <code>routes/web.php</code>). If you send automated POST requests without a valid CSRF token and corresponding session cookie, the server rejects them immediately with <strong>HTTP 419</strong> before your login rate limiter even executes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              2. Solution A: Enable "Auto-fetch CSRF Token & Session Cookie"
            </h4>
            <p className="text-slate-400 leading-relaxed text-xs">
              Check the <strong className="text-emerald-300">Auto-fetch CSRF</strong> box (or click the <em>"Laravel Web Login (+CSRF)"</em> preset). Before firing each batch, the engine performs a GET request to the login page, extracts the CSRF token (from <code>_token</code> or meta tags) along with the active session cookies (e.g. <code>laravel_session</code>, <code>XSRF-TOKEN</code>), and attaches them to every POST request in the batch.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              3. Solution B: Test an API Route Instead (Recommended)
            </h4>
            <p className="text-slate-400 leading-relaxed text-xs">
              If your backend has an API login endpoint (defined in <code>routes/api.php</code> such as <code>/api/login</code> or <code>/api/v1/auth</code>):
            </p>
            <ul className="list-disc list-inside text-slate-400 text-xs space-y-1 pl-2">
              <li>API routes normally do <strong>not</strong> use the <code>web</code> session middleware group and require no CSRF token.</li>
              <li>Requests hit your rate limiter directly (e.g. <code>throttle:api</code> or <code>throttle:login</code>).</li>
              <li>Test with method <code className="text-indigo-300">POST</code>, header <code className="text-indigo-300">Content-Type: application/json</code>, and a JSON body.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Call to action */}
      <div className="text-center pt-4 pb-8">
        <button
          onClick={onStartTest}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2 transition"
        >
          Ready to Start? Configure a Test <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
