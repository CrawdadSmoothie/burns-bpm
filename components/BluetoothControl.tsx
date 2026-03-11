"use client";

import type { BluetoothHeartRateResult, BluetoothStatus } from "@/hooks/useBluetoothHeartRate";

interface Props {
  hrMode:       "fake" | "bluetooth";
  onModeChange: (mode: "fake" | "bluetooth") => void;
  bt:           BluetoothHeartRateResult;
}

const STATUS_LABEL: Record<BluetoothStatus, string> = {
  idle:        "Not connected",
  connecting:  "Connecting…",
  connected:   "Connected",
  disconnected:"Disconnected",
  error:       "Connection failed",
  unavailable: "Bluetooth unavailable",
};

const STATUS_COLOR: Record<BluetoothStatus, string> = {
  idle:        "rgba(240,237,232,0.28)",
  connecting:  "#e8b84d",
  connected:   "#7cc8a0",
  disconnected:"rgba(240,237,232,0.28)",
  error:       "#e8705a",
  unavailable: "rgba(232,112,90,0.5)",
};

export default function BluetoothControl({ hrMode, onModeChange, bt }: Props) {
  const isMonitorMode = hrMode === "bluetooth";

  return (
    <div
      className="rounded-xl select-none"
      style={{
        background:           "rgba(12,11,10,0.88)",
        border:               "1px solid rgba(240,237,232,0.08)",
        backdropFilter:       "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow:            "0 4px 24px rgba(0,0,0,0.4)",
        opacity:              0.9,
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
          HR Source
        </span>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1 p-2">
        {(["fake", "bluetooth"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className="rounded-lg px-2 py-1.5 text-center transition-all duration-100 active:scale-95"
            style={{
              fontSize:      "10px",
              fontWeight:    600,
              letterSpacing: "0.04em",
              cursor:        "pointer",
              background:    hrMode === mode
                ? "rgba(240,237,232,0.10)"
                : "rgba(240,237,232,0.03)",
              border: hrMode === mode
                ? "1px solid rgba(240,237,232,0.18)"
                : "1px solid rgba(240,237,232,0.06)",
              color: hrMode === mode
                ? "#f0ede8"
                : "rgba(240,237,232,0.35)",
            }}
          >
            {mode === "fake" ? "Fake" : "Monitor"}
          </button>
        ))}
      </div>

      {/* Bluetooth status + controls — only when monitor mode is selected */}
      {isMonitorMode && (
        <div
          className="px-2 pb-2 flex flex-col gap-1.5"
          style={{ borderTop: "1px solid rgba(240,237,232,0.06)", paddingTop: "8px" }}
        >
          {/* Status row */}
          <div className="flex items-center gap-1.5 px-1">
            {/* Status dot */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: STATUS_COLOR[bt.status],
                boxShadow:  bt.status === "connected"
                  ? "0 0 5px rgba(124,200,160,0.6)"
                  : bt.status === "connecting"
                    ? "0 0 5px rgba(232,184,77,0.5)"
                    : "none",
              }}
            />
            <span
              className="text-[10px] font-medium"
              style={{ color: STATUS_COLOR[bt.status] }}
            >
              {STATUS_LABEL[bt.status]}
            </span>
          </div>

          {/* Error detail */}
          {bt.error && (
            <p
              className="text-[9px] px-1 leading-snug"
              style={{ color: "rgba(232,112,90,0.7)" }}
            >
              {bt.error}
            </p>
          )}

          {/* Connect / Disconnect button */}
          {bt.status === "connected" ? (
            <button
              onClick={bt.disconnect}
              className="w-full rounded-lg py-1.5 text-center transition-all duration-100 active:scale-95"
              style={{
                fontSize:   "10px",
                fontWeight: 600,
                cursor:     "pointer",
                background: "rgba(232,112,90,0.08)",
                border:     "1px solid rgba(232,112,90,0.18)",
                color:      "#e8705a",
              }}
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={bt.connect}
              disabled={bt.status === "connecting" || bt.status === "unavailable"}
              className="w-full rounded-lg py-1.5 text-center transition-all duration-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontSize:   "10px",
                fontWeight: 600,
                cursor:     bt.status === "connecting" ? "default" : "pointer",
                background: "rgba(124,200,160,0.08)",
                border:     "1px solid rgba(124,200,160,0.18)",
                color:      "#7cc8a0",
              }}
            >
              {bt.status === "connecting" ? "Connecting…" : "Connect Monitor"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
