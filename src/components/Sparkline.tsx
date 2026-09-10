"use client";

import React from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
}

export function Sparkline({
  data,
  width = 500,
  height = 120,
  className = "",
  color = "#6366f1", // indigo-500
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs ${className}`}
        style={{ height }}
      >
        Waiting for latency samples...
      </div>
    );
  }

  const padding = 10;
  const chartWidth = width;
  const chartHeight = height;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max === min ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = padding + (idx / Math.max(1, data.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((val - min) / range) * (chartHeight - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pointsString = points.join(" ");

  // Create area polygon for subtle gradient fill
  const firstPoint = points[0].split(",");
  const lastPoint = points[points.length - 1].split(",");
  const areaPoints = `${firstPoint[0]},${chartHeight} ${pointsString} ${lastPoint[0]},${chartHeight}`;

  const latestVal = data[data.length - 1];

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <polygon points={areaPoints} fill="url(#sparklineGrad)" />

        {/* Line stroke */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsString}
        />

        {/* Latest point circle */}
        {data.length > 0 && (
          <circle
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="3.5"
            fill="#ffffff"
            stroke={color}
            strokeWidth="2"
          />
        )}
      </svg>

      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
        <span>Min: {min}ms</span>
        <span>Latest: <strong className="text-slate-200">{latestVal}ms</strong></span>
        <span>Max: {max}ms</span>
      </div>
    </div>
  );
}
