// ─── Burns BPM — Intensity zone definitions ──────────────────────────────────
// Single source of truth for all zone labels, thresholds, and colors.
// Components should import from here rather than defining their own mappings.

export type HeartZone =
  | "Chill"
  | "Vibing"
  | "LockedIn"
  | "BourbonIsNecessary"
  | "UnfilteredRage";

export interface ZoneMeta {
  label: string;
  /** Shown as a secondary line beneath the label. null = no secondary line. */
  category: string | null;
  color: string;
  rgb: string;
}

export const ZONE_CONFIG: Record<HeartZone, ZoneMeta> = {
  Chill:               { label: "Chillin'",             category: null,      color: "#7cc8a0", rgb: "124,200,160" },
  Vibing:              { label: "Vibing",               category: null,      color: "#5ab5e8", rgb: "90,181,232"  },
  LockedIn:            { label: "Locked In",            category: null,      color: "#e8b84d", rgb: "232,184,77"  },
  BourbonIsNecessary:  { label: "Bourbon Is Necessary", category: "Redline", color: "#e8705a", rgb: "232,112,90"  },
  UnfilteredRage:      { label: "UNFILTERED RAGE",      category: "Redline", color: "#ff3b20", rgb: "255,59,32"   },
};

// BPM thresholds — tuned for seated gaming
// < 80  → Chill
// 80–94  → Vibing
// 95–109 → Locked In
// 110–124 → Bourbon Is Necessary
// 125+  → UNFILTERED RAGE
export function getRawIntensity(bpm: number): HeartZone {
  if (bpm < 80)  return "Chill";
  if (bpm < 95)  return "Vibing";
  if (bpm < 110) return "LockedIn";
  if (bpm < 125) return "BourbonIsNecessary";
  return "UnfilteredRage";
}

// ─── Rotating sub-messages per zone ─────────────────────────────────────────
// Displayed beneath the zone label, rotating every 12–18 seconds.
// Reset to index 0 whenever the zone changes.
export const ZONE_MESSAGES: Record<HeartZone, string[]> = {
  Chill:              ["Probably free play",           "Just warming up",               "Just logged on"              ],
  Vibing:             ["Clean touches",                "Feeling it",                    "Might be a good night"       ],
  LockedIn:           ["Sweaty lobby detected",        "Sitting up",                    "Defense simulator"           ],
  BourbonIsNecessary: ["Might have missed the open net","Teammate isn't rotating",      "Matt stole his boost",        "Chase is laughing (other team)"],
  UnfilteredRage:     ["What was that rotation?",      "Uninstall incoming",            "Smurfing detected",           "Somebody check on Burns"      ],
};

// Hysteresis: once in UNFILTERED RAGE (≥125), stay there until bpm drops to ≤122
export function applyHysteresis(
  raw: HeartZone,
  current: HeartZone,
  bpm: number
): HeartZone {
  if (current === "UnfilteredRage" && bpm > 122) return "UnfilteredRage";
  return raw;
}
