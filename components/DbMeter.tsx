"use client";

import { useEffect, useRef, useState } from "react";
import {
  type MicState,
  MIC_STATE_CONFIG,
  getMicState,
} from "@/lib/micLevels";

interface Props {
  /** Normalized loudness 0–100. */
  level:      number;
  permitted:  boolean;
  requesting: boolean;
}

const DEBOUNCE_TICKS = 3;

const DB_CLASS: Record<MicState, string> = {
  Muttering:   "db-muttering",
  Talking:     "db-talking",
  GettingLoud: "db-loud",
  Yelling:     "db-yelling",
  Screaming:   "db-screaming",
};

const DB_BG: Record<MicState, string> = {
  Muttering:   "rgba(255,255,255,0.03)",
  Talking:     "rgba(255,255,255,0.03)",
  GettingLoud: "rgba(232,184,77,0.04)",
  Yelling:     "rgba(232,112,90,0.04)",
  Screaming:   "rgba(255,59,32,0.06)",
};

export default function DbMeter({ level, permitted, requesting }: Props) {

  // ── Debounced mic state ────────────────────────────────────────────────────
  const [micState, setMicState]  = useState<MicState>("Muttering");
  const pendingRef               = useRef<MicState>("Muttering");
  const stableTicksRef           = useRef(0);

  useEffect(() => {
    if (!permitted) return;
    const raw = getMicState(level);
    if (raw === pendingRef.current) {
      stableTicksRef.current++;
      if (stableTicksRef.current >= DEBOUNCE_TICKS) setMicState(raw);
    } else {
      pendingRef.current     = raw;
      stableTicksRef.current = 1;
    }
  }, [level, permitted]);

  const meta    = MIC_STATE_CONFIG[micState];
  const active  = permitted;
  const barFill = active ? level : 0;

  return (
    <div
      className={`flex-1 min-w-0 rounded-2xl px-3 py-2.5 db-container ${active ? DB_CLASS[micState] : ""}`}
      style={{
        background:  active ? DB_BG[micState] : "rgba(255,255,255,0.03)",
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
          dB
        </span>
        <span
          className="text-[10px] font-semibold tracking-wide transition-colors duration-500 truncate text-right"
          style={{
            color: active
              ? meta.color
              : "rgba(240,237,232,0.18)",
          }}
        >
          {active ? meta.label : requesting ? "…" : "off"}
        </span>
      </div>

      {/* Bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "3px", background: "rgba(240,237,232,0.08)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{
            width:     `${barFill}%`,
            background: active ? `rgba(${meta.rgb}, 0.8)` : "transparent",
            boxShadow:  active && barFill > 20
              ? `0 0 6px rgba(${meta.rgb}, 0.5)`
              : "none",
          }}
        />
      </div>
    </div>
  );
}
