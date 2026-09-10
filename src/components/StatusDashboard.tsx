"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  Gauge,
  ExternalLink,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { JobSafeStatus } from "@/lib/types";
import { Sparkline } from "./Sparkline";

interface StatusDashboardProps {
  jobId: string;
  onReset: () => void;
  sharedSecret: string;
}

export function StatusDashboard({ jobId, onReset, sharedSecret }: StatusDashboardProps) {
  const [job, setJob] = useState<JobSafeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Poll status endpoint
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/job/${jobId}/status`, {
        headers: {
          ...(sharedSecret.trim() ? { "x-tool-secret": sharedSecret.trim() } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Job not found in database.");
        }
        throw new Error(`Failed to fetch status (HTTP ${res.status})`);
      }

      const data: JobSafeStatus = await res.json();
      setJob(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to update job status.");
    } finally {
      setLoading(false);
    }
  }, [jobId, sharedSecret]);

  useEffect(() => {
    fetchStatus();

    // Set up polling interval: every 1.5 seconds while status is "running"
    const interval = setInterval(() => {
      setJob((current) => {
        if (!current || current.status === "running") {
          fetchStatus();
        }
        return current;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Handle Stop Job
  const handleStop = async () => {
    if (!job || job.status !== "running" || stopping) return;

    setStopping(true);
    try {
      const res = await fetch(`/api/job/${jobId}/stop`, {
        method: "POST",
        headers: {
          ...(sharedSecret.trim() ? { "x-tool-secret": sharedSecret.trim() } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to stop job");
      }

      // Refresh immediately
      await fetchStatus();
    } catch (err: any) {
      alert(`Error stopping job: ${err.message}`);
    } finally {
      setStopping(false);
    }
  };

  const copySummary = () => {
    if (!job) return;
    const summary = [
      `--- Rate Limit Test Summary ---`,
      `Job ID: ${job.id}`,
      `Target: ${job.targetMethod} ${job.targetUrl}`,
      `Status: ${job.status.toUpperCase()}`,
      `Sent: ${job.sent} / ${job.maxRequests} requests`,
      `First 429: ${job.first429At ? `Request #${job.first429At}` : "None encountered"}`,
      `Average Latency: ${job.avgLatency ? `${job.avgLatency}ms` : "N/A"}`,
      `Min/Max Latency: ${job.minLatency || 0}ms / ${job.maxLatency || 0}ms`,
      `Status Codes: ${JSON.stringify(job.statusCounts, null, 2)}`,
    ].join("\n");

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !job) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center shadow-xl">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-300 font-medium">Connecting to job feed...</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">{jobId}</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-xl">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Failed to Load Job</h3>
        <p className="text-sm text-slate-400 mb-6">{error}</p>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition"
        >
          Return to Setup
        </button>
      </div>
    );
  }

  if (!job) return null;

  const percentComplete = Math.min(
    100,
    Math.round((job.sent / Math.max(1, job.maxRequests)) * 100)
  );

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - job.createdAt) / 1000));
  const elapsedFormatted = `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

  const totalAllowedSeconds = job.maxDurationMinutes * 60;
  const remainingSeconds = Math.max(0, totalAllowedSeconds - elapsedSeconds);
  const remainingFormatted = `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`;

  // Status breakdown calculations
  const count200 = job.statusCounts["200"] || 0;
  const count429 = job.statusCounts["429"] || 0;
  const countOther4xx = Object.entries(job.statusCounts).reduce((acc, [code, cnt]) => {
    if (code.startsWith("4") && code !== "429") return acc + cnt;
    return acc;
  }, 0);
  const count5xx = Object.entries(job.statusCounts).reduce((acc, [code, cnt]) => {
    if (code.startsWith("5")) return acc + cnt;
    return acc;
  }, 0);
  const countErrors = (job.statusCounts["ERR"] || 0) + (job.statusCounts["0"] || 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={onReset}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                title="Back to Config"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Live Test Run
              </h2>

              {/* Status Badge */}
              {job.status === "running" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  RUNNING
                </span>
              )}
              {job.status === "stopped" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                  <Square className="w-2.5 h-2.5 fill-current" />
                  STOPPED
                </span>
              )}
              {job.status === "completed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  <CheckCircle2 className="w-3 h-3" />
                  COMPLETED
                </span>
              )}
              {job.status === "failed" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                  <AlertTriangle className="w-3 h-3" />
                  FAILED
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 font-mono break-all flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold">
                {job.targetMethod}
              </span>
              <span>{job.targetUrl}</span>
              {job.autoCsrf && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-sans font-semibold">
                  Auto-CSRF Active
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* STOP BUTTON */}
            {job.status === "running" && (
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition disabled:opacity-50"
              >
                {stopping ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 fill-current" />
                )}
                <span>STOP TEST</span>
              </button>
            )}

            <button
              type="button"
              onClick={copySummary}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Summary
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition"
            >
              New Test
            </button>
          </div>
        </div>

        {/* First 429 Alert Banner */}
        {job.first429At !== null ? (
          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
                  Rate Limiting Triggered
                </h4>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  HTTP 429 Detected
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Target endpoint began rejecting requests at request{" "}
                <strong className="text-white font-mono text-sm underline decoration-amber-400">
                  #{job.first429At}
                </strong>{" "}
                out of {job.maxRequests} maximum requests.
              </p>
            </div>
          </div>
        ) : (
          job.sent > 0 && (
            <div className="mt-6 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                No 429 Rate Limiting encountered yet ({job.sent} requests sent).
              </span>
              <span className="text-[11px] text-slate-400">Batch size: {job.batchSize} / tick</span>
            </div>
          )
        )}

        {/* Progress Bar & Key Counters */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">
              Progress: <strong className="text-white font-mono">{job.sent}</strong> / {job.maxRequests} requests ({percentComplete}%)
            </span>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Elapsed: <span className="text-slate-200 font-mono">{elapsedFormatted}</span>
              {job.status === "running" && (
                <span className="text-slate-500">
                  (limit: {job.maxDurationMinutes}m, remaining: {remainingFormatted})
                </span>
              )}
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                job.first429At !== null
                  ? "bg-gradient-to-r from-indigo-500 via-amber-500 to-rose-500"
                  : "bg-indigo-500"
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              200 OK
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {count200}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {job.sent > 0 ? Math.round((count200 / job.sent) * 100) : 0}% of sent
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
              429 Rate Limited
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {count429}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {job.sent > 0 ? Math.round((count429 / job.sent) * 100) : 0}% of sent
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Avg Latency
            </div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
              {job.avgLatency !== null ? `${job.avgLatency}ms` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Min: {job.minLatency ?? "—"}ms | Max: {job.maxLatency ?? "—"}ms
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Server/Net Errors
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {count5xx + countErrors + countOther4xx}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              5xx: {count5xx} | Other 4xx: {countOther4xx} | Net: {countErrors}
            </div>
          </div>
        </div>
      </div>

      {/* Latency Sparkline Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Latency Sparkline (Rolling Last {Math.min(200, job.latencies.length)} Samples)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizing network response times across successive batch ticks
            </p>
          </div>
          {job.latencies.length > 0 && (
            <span className="text-xs font-mono text-slate-400">
              {job.latencies.length} points
            </span>
          )}
        </div>

        <Sparkline
          data={job.latencies}
          height={110}
          color={job.first429At !== null ? "#f59e0b" : "#6366f1"}
        />
      </div>

      {/* Status Code Distribution Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-400" />
          Status Code Breakdown
        </h3>

        {Object.keys(job.statusCounts).length === 0 ? (
          <p className="text-xs text-slate-500 italic">No responses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-sans">
                  <th className="py-2 px-3">Status Code</th>
                  <th className="py-2 px-3">Count</th>
                  <th className="py-2 px-3">Share</th>
                  <th className="py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(job.statusCounts).map(([status, count]) => {
                  const pct = job.sent > 0 ? ((count / job.sent) * 100).toFixed(1) : "0";
                  let badgeColor = "bg-slate-800 text-slate-300";
                  let desc = "HTTP Response";

                  if (status === "200") {
                    badgeColor = "bg-emerald-950 text-emerald-300 border border-emerald-800";
                    desc = "OK (Successful)";
                  } else if (status === "429") {
                    badgeColor = "bg-amber-950 text-amber-300 border border-amber-800";
                    desc = "Too Many Requests (Rate Limited)";
                  } else if (status.startsWith("5")) {
                    badgeColor = "bg-rose-950 text-rose-300 border border-rose-800";
                    desc = "Server Error";
                  } else if (status === "ERR") {
                    badgeColor = "bg-red-950 text-red-300 border border-red-800";
                    desc = "Network / Connection Error";
                  }

                  return (
                    <tr key={status} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded font-bold ${badgeColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-200 font-bold">{count}</td>
                      <td className="py-2 px-3 text-slate-400">{pct}%</td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
