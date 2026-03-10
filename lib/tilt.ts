// ─── Burns BPM — Tilt Meter configuration ────────────────────────────────────
// Measures BPM acceleration (delta over ~5 seconds) and maps it to a
// named state with display metadata. Used by the TiltMeter component.

export type TiltState = "Stable" | "HeatingUp" | "TiltRising" | "Meltdown";

export interface TiltMeta {
  label: string;
  color: string;
  rgb: string;
}

// Delta thresholds (bpm gained over the last 5 seconds)
// < 8  → Stable
// 8–14 → Heating Up
// 15–21 → Tilt Rising
// 22+  → MELTDOWN IMMINENT
export const TILT_CONFIG: Record<TiltState, TiltMeta> = {
  Stable:     { label: "Stable",            color: "#7cc8a0", rgb: "124,200,160" },
  HeatingUp:  { label: "Heating Up",        color: "#e8b84d", rgb: "232,184,77"  },
  TiltRising: { label: "Tilt Rising",       color: "#e8705a", rgb: "232,112,90"  },
  Meltdown:   { label: "MELTDOWN IMMINENT", color: "#ff3b20", rgb: "255,59,32"   },
};

export function getTiltState(delta: number): TiltState {
  if (delta >= 22) return "Meltdown";
  if (delta >= 15) return "TiltRising";
  if (delta >= 8)  return "HeatingUp";
  return "Stable";
}

/** Normalized 0–1 fill for the progress bar (saturates at delta = 30). */
export function tiltBarFill(delta: number): number {
  return Math.min(Math.max(delta / 30, 0), 1);
}
