"use client";

import type { OverrideCmd } from "@/hooks/useFakeHeartRate";

interface Props {
  onCommand: (cmd: OverrideCmd) => void;
}

const BUTTONS: { label: string; cmd: OverrideCmd; color: string; description: string }[] = [
  { label: "Calm",  cmd: "cancel", color: "#7cc8a0",              description: "→ baseline"    },
  { label: "Ramp",  cmd: "ramp",   color: "#5ab5e8",              description: "slow climb"     },
  { label: "Spike", cmd: "bump",   color: "#e8b84d",              description: "+20–30 bpm"     },
  { label: "Rage",  cmd: "rage",   color: "#ff3b20",              description: "→ 155–165"      },
  { label: "Drop",  cmd: "drop",   color: "#5ab5e8",              description: "−20 bpm fast"   },
  { label: "Reset", cmd: "cancel", color: "rgba(240,237,232,0.4)", description: "→ baseline"    },
];

export default function DevControls({ onCommand }: Props) {
  return (
    <div
      className="fixed top-4 right-4 z-40 rounded-xl select-none"
      style={{
        background:           "rgba(12,11,10,0.88)",
        border:               "1px solid rgba(240,237,232,0.08)",
        backdropFilter:       "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow:            "0 4px 24px rgba(0,0,0,0.4)",
        opacity:              0.85,
        minWidth:             "148px",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid rgba(240,237,232,0.06)" }}
      >
        <span
          className="text-[9px] tracking-[0.20em] uppercase font-semibold"
          style={{ color: "rgba(240,237,232,0.22)" }}
        >
          Dev Controls
        </span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-1 p-2">
        {BUTTONS.map(({ label, cmd, color, description }) => (
          <button
            key={label}
            onClick={() => onCommand(cmd)}
            title={description}
            className="rounded-lg px-2.5 py-1.5 text-left transition-all duration-100 active:scale-95 hover:opacity-100"
            style={{
              background: "rgba(240,237,232,0.04)",
              border:     "1px solid rgba(240,237,232,0.07)",
              color,
              fontSize:   "10px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              opacity:    0.8,
              cursor:     "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
