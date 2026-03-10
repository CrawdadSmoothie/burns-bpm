// ─── Burns BPM — dB Meter configuration ──────────────────────────────────────
// State labels, colors, and rotating message pools for the microphone
// loudness module. Mirrors the visual language of zones.ts and tilt.ts.

export type MicState =
  | "Muttering"
  | "Talking"
  | "GettingLoud"
  | "Yelling"
  | "Screaming";

export interface MicStateMeta {
  label: string;
  color: string;
  rgb: string;
}

export const MIC_STATE_CONFIG: Record<MicState, MicStateMeta> = {
  Muttering:   { label: "Muttering",    color: "#7cc8a0", rgb: "124,200,160" },
  Talking:     { label: "Talking",      color: "#5ab5e8", rgb: "90,181,232"  },
  GettingLoud: { label: "Getting Loud", color: "#e8b84d", rgb: "232,184,77"  },
  Yelling:     { label: "Yelling",      color: "#e8705a", rgb: "232,112,90"  },
  Screaming:   { label: "SCREAMING",    color: "#ff3b20", rgb: "255,59,32"   },
};

// Level thresholds: 0–20 Muttering, 20–40 Talking, 40–60 Getting Loud,
// 60–80 Yelling, 80–100 SCREAMING
export function getMicState(level: number): MicState {
  if (level >= 80) return "Screaming";
  if (level >= 60) return "Yelling";
  if (level >= 40) return "GettingLoud";
  if (level >= 20) return "Talking";
  return "Muttering";
}

export const MIC_MESSAGES: Record<MicState, string[]> = {
  Muttering:   ["probably focused",         "plotting revenge",          "breathing heavily"         ],
  Talking:     ["normal comms",             "explaining the rotation",   "calm analysis"             ],
  GettingLoud: ["this lobby is suspicious", "something went wrong",      "explaining aggressively"   ],
  Yelling:     ["somebody whiffed",         "that was an open net",      "controller under stress"   ],
  Screaming:   ["headset peaking",          "neighbors heard that",      "absolute meltdown",         "discord clipping"],
};
