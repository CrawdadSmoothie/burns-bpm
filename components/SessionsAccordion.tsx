"use client";

import { useState } from "react";
import type { SavedSession } from "@/app/page";
import SessionChart from "@/components/SessionChart";

interface Props {
  sessions: SavedSession[];
  onDelete: (id: string) => void;
}

function zoneColor(peak: number): string {
  if (peak >= 110) return "#e8705a";
  if (peak >= 120) return "#e8b84d";
  if (peak >= 90)  return "#5ab5e8";
  return "#7cc8a0";
}

function sessionEmoji(peak: number): string {
  if (peak >= 160) return "🔥";
  if (peak >= 110) return "⚡";
  if (peak >= 120) return "💪";
  if (peak >= 100) return "🏃";
  return "😌";
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
  });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`;
}

// Mini arc for session card (simplified, purely decorative)
function PeakArc({ peak }: { peak: number }) {
  const pct = Math.min(Math.max((peak - 40) / 160, 0), 1);
  const color = zoneColor(peak);
  const r = 14;
  const stroke = 3;
  const cx = 18;
  const cy = 18;
  const startAngle = 135;
  const sweep = pct * 270;

  function pt(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arc(start: number, sw: number) {
    if (sw <= 0) return "";
    const s = pt(start);
    const e = pt(start + sw);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sw > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  return (
    <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0">
      <path d={arc(startAngle, 270)} fill="none" stroke="rgba(240,237,232,0.07)" strokeWidth={stroke} strokeLinecap="round" />
      {sweep > 0.5 && (
        <path d={arc(startAngle, sweep)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          style={{ opacity: 0.9 }} />
      )}
      <text x="18" y="22" textAnchor="middle" fontSize="10" fill="rgba(240,237,232,0.6)"
        fontFamily="-apple-system, sans-serif" fontWeight="600">
        {peak}
      </text>
    </svg>
  );
}

export default function SessionsAccordion({ sessions, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10" style={{ color: "rgba(240,237,232,0.2)" }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span className="text-sm tracking-wide">End a session to see it here</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {[...sessions].reverse().map((s) => {
        const isOpen = open === s.id;
        const color  = zoneColor(s.peak);

        return (
          <div
            key={s.id}
            className="rounded-2xl overflow-hidden transition-all duration-200"
            style={{ background: "#1f1e1b", border: "1px solid rgba(240,237,232,0.07)" }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : s.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150"
              style={{ cursor: "pointer" }}
            >
              {/* Mini arc indicator */}
              <PeakArc peak={s.peak} />

              {/* Date + time */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#f0ede8" }}>
                  {sessionEmoji(s.peak)}&nbsp; {fmtDate(s.startTime)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(240,237,232,0.3)" }}>
                  {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (open === s.id) setOpen(null);
                  onDelete(s.id);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0 transition-all duration-150 hover:bg-red-500/10"
                style={{ color: "rgba(240,237,232,0.3)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8705a")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(240,237,232,0.3)")}
                aria-label="Delete session"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
                <span className="text-xs font-medium tracking-wide">Delete</span>
              </button>

              {/* Avg bpm */}
              <div className="text-right shrink-0">
                <p
                  className="text-base font-bold tabular-nums"
                  style={{
                    color,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.averageBpm}
                </p>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: "rgba(240,237,232,0.25)" }}>
                  avg
                </p>
              </div>

              {/* Chevron */}
              <svg
                viewBox="0 0 24 24"
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                style={{ color: "rgba(240,237,232,0.2)" }}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div
                className="px-4 pb-4 pt-3 animate-fadeIn flex flex-col gap-3"
                style={{ borderTop: "1px solid rgba(240,237,232,0.06)" }}
              >
                {/* Chart */}
                {s.dataPoints && s.dataPoints.length >= 2 ? (
                  <div
                    className="rounded-xl overflow-hidden px-2 pt-3 pb-1"
                    style={{ background: "#272521" }}
                  >
                    <SessionChart points={s.dataPoints} height={160} />
                  </div>
                ) : (
                  <div
                    className="rounded-xl flex items-center justify-center py-6 text-xs tracking-wide"
                    style={{ background: "#272521", color: "rgba(240,237,232,0.2)" }}
                  >
                    No chart data
                  </div>
                )}

                {/* Stat tiles */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Peak",     value: `${s.peak}`,                    accent: zoneColor(s.peak) },
                    { label: "Low",      value: `${s.lowBpm}`,                  accent: undefined },
                    { label: "Duration", value: fmtDuration(s.durationSeconds), accent: undefined },
                    { label: "Redline",  value: `${s.percentAbove140}%`,        accent: s.percentAbove140 > 0 ? "#e8705a" : undefined },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-col items-center gap-1 rounded-xl py-3"
                      style={{ background: "#272521" }}
                    >
                      <span
                        className="text-base font-bold tabular-nums"
                        style={{
                          color: item.accent ?? "#f0ede8",
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {item.value}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: "rgba(240,237,232,0.25)" }}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
