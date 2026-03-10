"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BpmHero from "@/components/BpmHero";
import SessionChart from "@/components/SessionChart";
import StatsRow from "@/components/StatsRow";
import SessionsAccordion from "@/components/SessionsAccordion";
import TiltMeter from "@/components/TiltMeter";
import DbMeter from "@/components/DbMeter";
import DevControls from "@/components/DevControls";
import { useFakeHeartRate, type HeartRatePoint } from "@/hooks/useFakeHeartRate";
import { useSessionStats } from "@/hooks/useSessionStats";
import { useMicLevel } from "@/hooks/useMicLevel";
import { extractChartEvents } from "@/lib/chartEvents";

export interface SavedSession {
  id: string;
  startTime: number;
  endTime: number;
  averageBpm: number;
  peak: number;
  lowBpm: number;
  durationSeconds: number;
  percentAbove140: number;
  dataPoints: HeartRatePoint[];
}

const STORAGE_KEY = "hrd_sessions_v3";
const MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000;

function loadSessions(): SavedSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: SavedSession[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    return all.filter((s) => s.endTime > cutoff);
  } catch {
    return [];
  }
}

function saveSessions(sessions: SavedSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function todayLabel(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month:   "long",
    day:     "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

export default function Page() {
  const [sessionActive, setSessionActive] = useState(true);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  // ── Mic level — single tap shared by DbMeter and the session timeline ──────
  const { level: micLevel, permitted: micPermitted, requesting: micRequesting } =
    useMicLevel();

  // Ref that useFakeHeartRate reads at each 1-second tick.
  // Stays null until permission is granted so dbLevel is never fabricated.
  const dbLevelRef = useRef<number | null>(null);
  useEffect(() => {
    dbLevelRef.current = micPermitted ? micLevel : null;
  }, [micLevel, micPermitted]);

  const { points, trigger } = useFakeHeartRate(sessionActive, dbLevelRef);
  const stats       = useSessionStats(points);
  const currentBpm  = points.length > 0 ? points[points.length - 1].bpm : 0;
  const startTime   = points.length > 0 ? points[0].timestamp : null;
  const chartEvents = useMemo(() => extractChartEvents(points), [points]);

  // ── UNFILTERED RAGE banner — fires once per session on first ≥150 crossing ─
  const rageTriggeredRef    = useRef(false);
  const prevBpmRef          = useRef(0);
  const rageBannerTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRageBanner, setShowRageBanner] = useState(false);

  // Reset when a new session starts
  useEffect(() => {
    if (!sessionActive) return;
    rageTriggeredRef.current = false;
    prevBpmRef.current = 0;
  }, [sessionActive]);

  // Detect first crossing from <150 → ≥150
  useEffect(() => {
    if (!sessionActive || rageTriggeredRef.current) return;
    if (prevBpmRef.current < 150 && currentBpm >= 150) {
      rageTriggeredRef.current = true;
      setShowRageBanner(true);
      if (rageBannerTimerRef.current) clearTimeout(rageBannerTimerRef.current);
      rageBannerTimerRef.current = setTimeout(() => setShowRageBanner(false), 2000);
    }
    prevBpmRef.current = currentBpm;
  }, [currentBpm, sessionActive]);

  useEffect(() => {
    const loaded = loadSessions();
    setSavedSessions(loaded);
    saveSessions(loaded);
  }, []);

  const handleEndSession = useCallback(() => {
    if (points.length < 2) return;
    setSessionActive(false);

    const session: SavedSession = {
      id:              `${Date.now()}`,
      startTime:       points[0].timestamp,
      endTime:         points[points.length - 1].timestamp,
      averageBpm:      stats.average,
      peak:            stats.peak,
      lowBpm:          stats.low,
      durationSeconds: stats.durationSeconds,
      percentAbove140: stats.percentAbove140,
      dataPoints:      points,
    };

    setSavedSessions((prev) => {
      const updated = [...prev, session];
      saveSessions(updated);
      return updated;
    });
  }, [points, stats]);

  const handleNewSession = useCallback(() => {
    setSessionActive(true);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSavedSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
  }, []);

  return (
    <main
      className="min-h-screen antialiased"
      style={{ background: "#100f0d", color: "#f0ede8" }}
    >
      {/* ── Max-width wrapper ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 lg:px-10 pb-24">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between pt-8 pb-6 lg:pt-10">
          {/* Left: title + date stacked */}
          <div className="flex flex-col gap-1">
            <h1
              className="text-lg font-bold tracking-tight leading-none"
              style={{
                color:      "#f0ede8",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
              }}
            >
              Burns Stress Log
            </h1>
            <span
              className="text-sm font-medium"
              style={{ color: "rgba(240,237,232,0.4)" }}
            >
              {todayLabel()}
            </span>
          </div>

          {/* Right: live/paused status */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${sessionActive ? "animate-pulse-dot" : ""}`}
              style={{
                background: sessionActive ? "#7cc8a0" : "rgba(240,237,232,0.2)",
                boxShadow:  sessionActive ? "0 0 6px rgba(124,200,160,0.6)" : "none",
              }}
            />
            <span
              className="text-[11px] tracking-widest uppercase font-medium"
              style={{ color: sessionActive ? "#7cc8a0" : "rgba(240,237,232,0.3)" }}
            >
              {sessionActive ? "Live" : "Paused"}
            </span>
          </div>
        </header>

        {/* ── Main content: hero left, detail right on lg ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] lg:gap-10 lg:items-start">

          {/* ── LEFT: BPM Hero ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center lg:sticky lg:top-10">
            <BpmHero bpm={currentBpm} />
            {/* Tilt Meter + dB Meter side-by-side */}
            <div className="flex gap-2 w-full max-w-[280px] mt-1">
              <TiltMeter points={points} />
              <DbMeter
                level={micLevel}
                permitted={micPermitted}
                requesting={micRequesting}
              />
            </div>

            {/* Action button — below hero on desktop */}
            <div className="w-full max-w-[280px] mt-2 hidden lg:block">
              <ActionButton
                sessionActive={sessionActive}
                disabled={points.length < 2}
                onEnd={handleEndSession}
                onNew={handleNewSession}
              />
            </div>
          </div>

          {/* ── RIGHT: Stats + Chart ───────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:pt-4">

            {/* Divider — mobile only */}
            <div
              className="lg:hidden mx-auto rounded-full"
              style={{ height: "1px", background: "rgba(240,237,232,0.06)", width: "200px" }}
            />

            {/* Stats */}
            <section>
              <SectionLabel>Session Stats</SectionLabel>
              <div className="mt-3">
                <StatsRow stats={stats} startTime={startTime} />
              </div>
            </section>

            {/* Chart */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Heart Rate</SectionLabel>
                <span
                  className="text-[11px] font-mono tabular-nums"
                  style={{ color: "rgba(240,237,232,0.2)" }}
                >
                  {points.length} pts
                </span>
              </div>
              <div
                className="rounded-2xl px-4 pt-4 pb-3"
                style={{
                  background: "#1f1e1b",
                  border: "1px solid rgba(240,237,232,0.07)",
                }}
              >
                <SessionChart points={points} events={chartEvents} />
              </div>
            </section>

            {/* Action button — below chart on mobile */}
            <div className="lg:hidden">
              <ActionButton
                sessionActive={sessionActive}
                disabled={points.length < 2}
                onEnd={handleEndSession}
                onNew={handleNewSession}
              />
            </div>
          </div>
        </div>

        {/* ── Previous sessions (always visible) ──────────────────────────── */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Previous Sessions</SectionLabel>
            {savedSessions.length > 0 && (
              <span className="text-[11px]" style={{ color: "rgba(240,237,232,0.2)" }}>
                {savedSessions.length} saved · Past 30 days
              </span>
            )}
          </div>
          <SessionsAccordion sessions={savedSessions} onDelete={handleDeleteSession} />
        </section>

      </div>

      {/* ── Dev Controls ─────────────────────────────────────────────────── */}
      <DevControls onCommand={trigger} />

      {/* ── UNFILTERED RAGE banner ────────────────────────────────────────── */}
      {showRageBanner && (
        <div
          className="fixed top-6 z-50 pointer-events-none animate-rage-banner"
          style={{ left: "50%" }}
        >
          <div
            className="rounded-xl px-5 py-2.5"
            style={{
              background:           "rgba(20,14,12,0.92)",
              border:               "1px solid rgba(255,59,32,0.35)",
              backdropFilter:       "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <span
              className="text-[11px] tracking-[0.16em] uppercase font-semibold"
              style={{ color: "#ff3b20" }}
            >
              ⚠ UNFILTERED RAGE ACTIVATED
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] tracking-[0.14em] uppercase font-medium"
      style={{ color: "rgba(240,237,232,0.3)" }}
    >
      {children}
    </p>
  );
}

function ActionButton({
  sessionActive,
  disabled,
  onEnd,
  onNew,
}: {
  sessionActive: boolean;
  disabled: boolean;
  onEnd: () => void;
  onNew: () => void;
}) {
  if (sessionActive) {
    return (
      <button
        onClick={onEnd}
        disabled={disabled}
        className="w-full py-4 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: "rgba(232,112,90,0.12)",
          border:     "1px solid rgba(232,112,90,0.25)",
          color:      "#e8705a",
        }}
      >
        End Session
      </button>
    );
  }

  return (
    <button
      onClick={onNew}
      className="w-full py-4 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 active:scale-[0.98]"
      style={{
        background: "rgba(124,200,160,0.12)",
        border:     "1px solid rgba(124,200,160,0.25)",
        color:      "#7cc8a0",
      }}
    >
      Start New Session
    </button>
  );
}
