"use client";

import type { SessionStats } from "@/hooks/useSessionStats";

interface Props {
  stats: SessionStats;
  startTime: number | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function zoneColor(bpm: number): string {
  if (bpm >= 140) return "#e8705a";
  if (bpm >= 120) return "#e8b84d";
  if (bpm >= 90)  return "#5ab5e8";
  return "#7cc8a0";
}

// ─── Shared type styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize:      "10px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight:    500,
  color:         "rgba(240,237,232,0.32)",
  marginBottom:  "4px",
};

const valueStyle: React.CSSProperties = {
  fontFamily:    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
  fontSize:      "1.25rem",
  fontWeight:    700,
  letterSpacing: "-0.025em",
  color:         "#f0ede8",
  lineHeight:    1,
};

const unitStyle: React.CSSProperties = {
  fontSize:   "0.7rem",
  fontWeight: 500,
  color:      "rgba(240,237,232,0.3)",
  marginLeft: "3px",
};

const divider = (
  <div style={{ height: "1px", background: "rgba(240,237,232,0.05)", margin: "0 20px" }} />
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatsRow({ stats, startTime }: Props) {
  const { peak, average, low, durationSeconds, percentAbove140 } = stats;
  const hasData  = peak > 0;
  const hasStart = startTime !== null;
  const dash     = "—";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#1f1e1b",
        border:     "1px solid rgba(240,237,232,0.07)",
      }}
    >
      {/* ── Started / Duration ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <p style={labelStyle}>Started</p>
          <p style={valueStyle}>{hasStart ? formatTime(startTime!) : dash}</p>
        </div>
        <div className="text-right">
          <p style={labelStyle}>Duration</p>
          <p style={{ ...valueStyle, color: hasData ? "#f0ede8" : "rgba(240,237,232,0.25)" }}>
            {hasData ? formatDuration(durationSeconds) : dash}
          </p>
        </div>
      </div>

      {divider}

      {/* ── Peak / Avg / Low ───────────────────────────────────────────── */}
      <div
        className="grid grid-cols-3"
        style={{ borderBottom: "1px solid rgba(240,237,232,0)" }}
      >
        {/* Peak */}
        <div
          className="px-5 py-4"
          style={{ borderRight: "1px solid rgba(240,237,232,0.05)" }}
        >
          <p style={labelStyle}>Peak</p>
          <p style={{ ...valueStyle, color: hasData ? zoneColor(peak) : "rgba(240,237,232,0.25)" }}>
            {hasData ? peak : dash}
            {hasData && <span style={unitStyle}>bpm</span>}
          </p>
          {hasData && stats.peakElapsedSeconds !== null && (
            <p style={{ fontSize: "9px", color: "rgba(240,237,232,0.28)", marginTop: "3px", letterSpacing: "0.05em" }}>
              @ {formatDuration(stats.peakElapsedSeconds)}
            </p>
          )}
        </div>

        {/* Avg */}
        <div
          className="px-5 py-4"
          style={{ borderRight: "1px solid rgba(240,237,232,0.05)" }}
        >
          <p style={labelStyle}>Avg</p>
          <p style={{ ...valueStyle, color: hasData ? "#f0ede8" : "rgba(240,237,232,0.25)" }}>
            {hasData ? average : dash}
            {hasData && <span style={unitStyle}>bpm</span>}
          </p>
        </div>

        {/* Low */}
        <div className="px-5 py-4">
          <p style={labelStyle}>Low</p>
          <p style={{ ...valueStyle, color: hasData ? "#f0ede8" : "rgba(240,237,232,0.25)" }}>
            {hasData ? low : dash}
            {hasData && <span style={unitStyle}>bpm</span>}
          </p>
        </div>
      </div>

      {divider}

      {/* ── Time in Redline ────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p style={labelStyle}>Time in Redline</p>
          <p
            style={{
              ...valueStyle,
              fontSize: "0.95rem",
              color: hasData && percentAbove140 > 0
                ? "#e8705a"
                : "rgba(240,237,232,0.25)",
            }}
          >
            {hasData ? `${percentAbove140}%` : dash}
          </p>
        </div>
        <div
          className="rounded-full overflow-hidden"
          style={{ height: "3px", background: "rgba(240,237,232,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${hasData ? percentAbove140 : 0}%`,
              background: percentAbove140 > 0
                ? "linear-gradient(to right, rgba(232,112,90,0.5), #e8705a)"
                : "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}
