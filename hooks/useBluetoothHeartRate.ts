"use client";

import { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BluetoothStatus =
  | "idle"          // not yet attempted
  | "connecting"    // requestDevice + GATT negotiation in progress
  | "connected"     // receiving notifications
  | "disconnected"  // was connected, device dropped
  | "error"         // failed to connect
  | "unavailable";  // Web Bluetooth not supported in this browser

export interface BluetoothHeartRateResult {
  bpm:        number;
  status:     BluetoothStatus;
  error:      string | null;
  connect:    () => Promise<void>;
  disconnect: () => void;
}

// ─── BLE Heart Rate Measurement parser ───────────────────────────────────────
//
// Characteristic format (Bluetooth SIG, Heart Rate Service):
//   Byte 0 — Flags
//     Bit 0: Heart Rate Value Format  0 = UINT8  1 = UINT16 (little-endian)
//   Byte 1 (or 1–2) — BPM value
//
function parseHeartRate(view: DataView): number {
  const flags  = view.getUint8(0);
  const is16   = (flags & 0x01) === 1;
  const bpm    = is16 ? view.getUint16(1, /*littleEndian=*/ true) : view.getUint8(1);
  return bpm;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBluetoothHeartRate(): BluetoothHeartRateResult {
  const bluetoothAvailable =
    typeof navigator !== "undefined" && "bluetooth" in navigator;

  const [bpm,    setBpm]    = useState(0);
  const [status, setStatus] = useState<BluetoothStatus>(
    bluetoothAvailable ? "idle" : "unavailable"
  );
  const [error, setError] = useState<string | null>(null);

  // Keep refs to clean up listeners on disconnect / unmount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef         = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const characteristicRef = useRef<any>(null);

  // Stable handler refs so add/removeEventListener use the same function object
  const onValueChangedRef = useRef<(e: Event) => void>(() => {});
  const onDisconnectRef   = useRef<() => void>(() => {});

  const teardown = useCallback(() => {
    characteristicRef.current?.removeEventListener(
      "characteristicvaluechanged",
      onValueChangedRef.current
    );
    deviceRef.current?.removeEventListener(
      "gattserverdisconnected",
      onDisconnectRef.current
    );
    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch { /* ignore — device may already be gone */ }
    characteristicRef.current = null;
    deviceRef.current         = null;
  }, []);

  const disconnect = useCallback(() => {
    teardown();
    setBpm(0);
    setStatus("idle");
    setError(null);
  }, [teardown]);

  const connect = useCallback(async () => {
    if (!bluetoothAvailable) {
      setStatus("unavailable");
      setError("Web Bluetooth is not available. Use Chrome or Edge over HTTPS / localhost.");
      return;
    }

    // Clean up any previous connection before attempting a new one
    teardown();
    setBpm(0);
    setStatus("connecting");
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bluetooth = (navigator as any).bluetooth;

      const device = await bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
      });
      deviceRef.current = device;

      // Stable disconnect handler
      onDisconnectRef.current = () => {
        setBpm(0);
        setStatus("disconnected");
      };
      device.addEventListener("gattserverdisconnected", onDisconnectRef.current);

      const server         = await device.gatt.connect();
      const service        = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");
      characteristicRef.current = characteristic;

      // Stable value-change handler
      onValueChangedRef.current = (e: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const view = (e.target as any).value as DataView | null;
        if (view) setBpm(parseHeartRate(view));
      };
      characteristic.addEventListener(
        "characteristicvaluechanged",
        onValueChangedRef.current
      );

      await characteristic.startNotifications();
      setStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // User dismissed the device picker — treat as idle, not a hard error
      if (
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("chosen") ||
        msg.toLowerCase().includes("no device")
      ) {
        setStatus("idle");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }, [bluetoothAvailable, teardown]);

  return { bpm, status, error, connect, disconnect };
}
