"use client";

import { useMemo } from "react";
import type { HeartRatePoint } from "./useFakeHeartRate";

export interface SessionStats {
  peak: number;
  low: number;
  average: number;
  durationSeconds: number;
  percentAbove140: number;
  /** Elapsed seconds from session start when the session peak was first reached. */
  peakElapsedSeconds: number | null;
}

const EMPTY: SessionStats = {
  peak: 0,
  low: 0,
  average: 0,
  durationSeconds: 0,
  percentAbove140: 0,
  peakElapsedSeconds: null,
};

export function useSessionStats(points: HeartRatePoint[]): SessionStats {
  return useMemo(() => {
    if (points.length === 0) return EMPTY;

    let sum = 0;
    let peak = -Infinity;
    let peakTs: number | null = null;
    let low = Infinity;
    let above140 = 0;

    for (const p of points) {
      sum += p.bpm;
      if (p.bpm > peak) { peak = p.bpm; peakTs = p.timestamp; }
      if (p.bpm < low) low = p.bpm;
      if (p.bpm > 140) above140++;
    }

    const startTs = points[0].timestamp;
    const durationSeconds =
      points.length > 1
        ? Math.round((points[points.length - 1].timestamp - startTs) / 1000)
        : 0;
    const peakElapsedSeconds =
      peakTs !== null ? Math.round((peakTs - startTs) / 1000) : null;

    return {
      peak,
      low,
      average: Math.round(sum / points.length),
      durationSeconds,
      percentAbove140: Math.round((above140 / points.length) * 100),
      peakElapsedSeconds,
    };
  }, [points]);
}
