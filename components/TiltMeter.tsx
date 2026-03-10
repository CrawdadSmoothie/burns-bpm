"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HeartRatePoint } from "@/hooks/useFakeHeartRate";
import {
  type TiltState,
  TILT_CONFIG,
  getTiltState,
  tiltBarFill,
} from "@/lib/tilt";

interface Props {
  points: HeartRatePoint[];
}

const WINDOW_MS      = 5_000;
const DEBOUNCE_TICKS = 3;

const TILT_CLASS: Record<TiltState, string> = {
  Stable:     "tilt-stable",
  HeatingUp:  "tilt-heating",
  TiltRising: "tilt-simmer",
  Meltdown:   "tilt-meltdown",
};

// Very faint background tint escalates with state
const TILT_BG: Record<TiltState, string> = {
  Stable:     "rgba(255,255,255,0.03)",
  HeatingUp:  "rgba(255,255,255,0.03)",
  TiltRising: "rgba(232,112,90,0.04)",
  Meltdown:   "rgba(255,59,32,0.06)",
};

export default function TiltMeter({ points }: Props) {
  const [tiltState, setTiltState] = useState<TiltState>("Stable");
  const pendingRef     = useRef<TiltState>("Stable");
  const stableTicksRef = useRef(0);

  // BPM delta over the last ~5 seconds — computed every tick
  const delta = useMemo(() => {
    if (points.length < 2) return 0;
    const now      = points[points.length - 1];
    const targetTs = now.timestamp - WINDOW_MS;
    // Walk forward to find the last point that is still ≤ targetTs
    let ref = points[0];
    for (const p of points) {
      if (p.timestamp <= targetTs) ref = p;
      else break;
    }
    return now.bpm - ref.bpm;
  }, [points]);

  // Debounced state: only commit after DEBOUNCE_TICKS consecutive ticks agree
  useEffect(() => {
    const raw = getTiltState(delta);
    if (raw === pendingRef.current) {
      stableTicksRef.current++;
      if (stableTicksRef.current >= DEBOUNCE_TICKS) {
        setTiltState(raw);
      }
    } else {
      pendingRef.current   = raw;
      stableTicksRef.current = 1;
    }
  }, [delta]);

  const meta = TILT_CONFIG[tiltState];
  const fill = tiltBarFill(Math.max(delta, 0));
  const active = points.length > 1;

  return (
    <div
      className={`flex-1 min-w-0 rounded-2xl px-3 py-2.5 tilt-container ${active ? TILT_CLASS[tiltState] : ""}`}
      style={{
        background:  active ? TILT_BG[tiltState] : "rgba(255,255,255,0.03)",
        borderWidth: "1px",
        borderStyle: "solid",
        transition:  "background 0.8s ease",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span
          className="text-[9px] tracking-[0.12em] uppercase font-medium shrink-0"
          style={{ color: "rgba(240,237,232,0.3)" }}
        >
          Tilt
        </span>
        <span
          className="text-[10px] font-semibold tracking-wide transition-colors duration-500 truncate text-right"
          style={{ color: active ? meta.color : "rgba(240,237,232,0.2)" }}
        >
          {active ? meta.label : "—"}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "3px", background: "rgba(240,237,232,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width:      active ? `${fill * 100}%` : "0%",
            background: `rgba(${meta.rgb}, 0.75)`,
          }}
        />
      </div>
    </div>
  );
}
