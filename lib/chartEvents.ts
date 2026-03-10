// ─── Burns BPM — Chart event extraction ──────────────────────────────────────
// Scans a session's HeartRatePoint array and returns the set of notable events
// to be displayed as markers on the SessionChart.

import type { HeartRatePoint } from "@/hooks/useFakeHeartRate";

export type ChartEventType = "peak" | "redline" | "meltdown";

export interface ChartEvent {
  timestamp: number;
  type: ChartEventType;
  bpm: number;
}

// Minimum BPM for a session peak to be worth marking (ignores baseline noise)
const PEAK_MIN_BPM = 105;

// Meltdown: BPM must be ≥150 AND have risen by at least this much over the
// previous ~5 seconds. Filters out small oscillations around the threshold.
const MELTDOWN_VELOCITY_BPM = 18;

// After a meltdown fires, BPM must fall below this before another can fire.
// A minimum time gap is also enforced as a secondary guard.
const MELTDOWN_RESET_BPM = 140;
const MELTDOWN_MIN_GAP_MS = 10_000;

/**
 * Derives chart event markers from a points array.
 *
 * "peak"     — exactly one marker, placed at the session's true highest BPM point.
 * "meltdown" — meaningful rage spike: BPM ≥150 with rapid rise, throttled by
 *              a cooldown that requires BPM to fall below 140 before re-firing.
 * "redline"  — first crossing from < 140 to ≥ 140 (lower-priority context marker).
 */
export function extractChartEvents(points: HeartRatePoint[]): ChartEvent[] {
  if (points.length < 2) return [];

  // ── Pass 1: locate the true session peak ────────────────────────────────
  let truePeakBpm = -Infinity;
  let truePeakTs  = points[0].timestamp;
  for (const p of points) {
    if (p.bpm > truePeakBpm) {
      truePeakBpm = p.bpm;
      truePeakTs  = p.timestamp;
    }
  }
  const hasMeaningfulPeak = truePeakBpm >= PEAK_MIN_BPM;

  // ── Pass 2: build event list ─────────────────────────────────────────────
  const events: ChartEvent[] = [];
  let peakMarked              = false;
  let redlineDone             = false;
  let prevBpm                 = points[0].bpm;
  let lastMeltdownTs          = -Infinity;
  // True once BPM has been below MELTDOWN_RESET_BPM since the last meltdown.
  // Starts true so the first meltdown can fire immediately.
  let meltdownResetReady      = true;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];

    // ── Peak: one marker at the true highest point ──────────────────────
    if (!peakMarked && hasMeaningfulPeak && p.timestamp === truePeakTs) {
      peakMarked = true;
      events.push({ timestamp: p.timestamp, type: "peak", bpm: p.bpm });
    }

    // ── Redline: first crossing from < 140 to ≥ 140 ────────────────────
    if (!redlineDone && prevBpm < 140 && p.bpm >= 140) {
      redlineDone = true;
      events.push({ timestamp: p.timestamp, type: "redline", bpm: p.bpm });
    }

    // ── Track whether BPM has cooled below reset threshold ─────────────
    if (p.bpm < MELTDOWN_RESET_BPM) {
      meltdownResetReady = true;
    }

    // ── Meltdown: ≥150 bpm with meaningful velocity ─────────────────────
    // Velocity = delta over the previous ~5 seconds (5 data points at 1 Hz)
    if (p.bpm >= 150 && meltdownResetReady) {
      const lookback    = Math.min(i, 5);
      const bpmAgo      = points[i - lookback].bpm;
      const velocity    = p.bpm - bpmAgo;
      const gapOk       = p.timestamp - lastMeltdownTs >= MELTDOWN_MIN_GAP_MS;

      if (velocity >= MELTDOWN_VELOCITY_BPM && gapOk) {
        lastMeltdownTs     = p.timestamp;
        meltdownResetReady = false;
        events.push({ timestamp: p.timestamp, type: "meltdown", bpm: p.bpm });
      }
    }

    prevBpm = p.bpm;
  }

  return events;
}
