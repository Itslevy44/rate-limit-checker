"use client";

import React, { useState, useEffect } from "react";
import { ConfigForm } from "@/components/ConfigForm";
import { StatusDashboard } from "@/components/StatusDashboard";
import { UserGuide } from "@/components/UserGuide";
import {
  Gauge,
  History,
  ShieldCheck,
  Server,
  Zap,
  ExternalLink,
  Info,
  BookOpen,
} from "lucide-react";

export default function Home() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [sharedSecret, setSharedSecret] = useState<string>("");
  const [recentJobs, setRecentJobs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"config" | "dashboard" | "guide">("config");

  // Load shared secret and recent jobs from localStorage
  useEffect(() => {
    try {
      const savedSecret = localStorage.getItem("rlt_shared_secret");
      if (savedSecret) setSharedSecret(savedSecret);

      const savedJobs = localStorage.getItem("rlt_recent_jobs");
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs);
        if (Array.isArray(parsed)) {
          setRecentJobs(parsed);
        }
      }
    } catch {}
  }, []);

  // Persist shared secret
  const handleSecretChange = (val: string) => {
    setSharedSecret(val);
    try {
      localStorage.setItem("rlt_shared_secret", val);
    } catch {}
  };

  // When a job starts
  const handleJobStarted = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveTab("dashboard");

    setRecentJobs((prev) => {
      const updated = [jobId, ...prev.filter((id) => id !== jobId)].slice(0, 10);
      try {
        localStorage.setItem("rlt_recent_jobs", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleReset = () => {
    setActiveTab("config");
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-white">
                  Rate Limit Tester
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Vercel + QStash
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Server-side load testing and real-time rate limit observability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {recentJobs.length > 0 && (
              <div className="relative">
                <select
                  value={activeJobId || ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActiveJobId(e.target.value);
                      setActiveTab("dashboard");
                    }
                  }}
                  className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                >
                  <option value="">Recent runs ({recentJobs.length})</option>
                  {recentJobs.map((id) => (
                    <option key={id} value={id}>
                      Job {id.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setActiveTab("config")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "config"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              New Test
            </button>

            {activeJobId && (
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "dashboard"
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                Dashboard
              </button>
            )}

            <button
              onClick={() => setActiveTab("guide")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === "guide"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Guide
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab !== "guide" && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3 flex items-start gap-2.5">
              <Server className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Stateless Batch Loop</strong>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Ticks fire via QStash self-rescheduling. Safe against Vercel execution timeouts.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Verified Stop Control</strong>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Halts pending QStash messages and rejects ticks immediately when status changes.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">1M Cap & Expiry</strong>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Up to 1,000,000 requests, 500 req/tick batches, and 24h automatic key expiration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* View Switch */}
        {activeTab === "guide" ? (
          <UserGuide onStartTest={() => setActiveTab("config")} />
        ) : activeTab === "config" || !activeJobId ? (
          <ConfigForm
            onJobStarted={handleJobStarted}
            sharedSecret={sharedSecret}
            setSharedSecret={handleSecretChange}
            onOpenGuide={() => setActiveTab("guide")}
          />
        ) : (
          <StatusDashboard
            jobId={activeJobId}
            onReset={handleReset}
            sharedSecret={sharedSecret}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Rate Limit Tester &bull; Next.js 14 App Router</span>
          <div className="flex items-center gap-4">
            <span>Upstash Redis + QStash Integration</span>
            <span>&bull;</span>
            <a
              href="/api/mock-target?limit=25"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline flex items-center gap-1"
            >
              Test Mock Endpoint <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
