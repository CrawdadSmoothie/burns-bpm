"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface HeartRatePoint {
  timestamp: number;
  bpm:       number;
  /** Normalized mic loudness 0–100. null when mic access is not granted. */
  dbLevel:   number | null;
}

const BASELINE_MIN = 75;
const BASELINE_MAX = 85;
const TICK_MS      = 1000;

// "hold" is new: a brief plateau between a spike/ramp peak and recovery
type Phase       = "baseline" | "ramp" | "spike" | "hold" | "recovery";
export type OverrideCmd = "spike" | "ramp" | "cancel" | "bump" | "rage" | "drop" | null;

interface State {
  current: number;
  phase: Phase;
  target: number;
  ticksInPhase: number;
  phaseDuration: number;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Pure state machine. `debug` widens random spike/ramp probabilities.
function nextState(s: State, debug: boolean): State {
  const { current, phase, target, ticksInPhase, phaseDuration } = s;

  const step  = (target - current) / Math.max(phaseDuration - ticksInPhase, 1);
  const noise = (Math.random() - 0.5) * 1.5;
  const next  = clamp(current + step + noise, 45, 220);

  if (phaseDuration - ticksInPhase - 1 > 0) {
    return { ...s, current: next, ticksInPhase: ticksInPhase + 1 };
  }

  const roll = Math.random();

  if (phase === "baseline") {
    const spikeChance = debug ? 0.15 : 0.05;
    const rampChance  = debug ? 0.35 : 0.15;
    if (roll < spikeChance) {
      return {
        current: next, phase: "spike",
        target: randomBetween(145, 175), ticksInPhase: 0,
        phaseDuration: Math.floor(randomBetween(6, 14)),
      };
    }
    if (roll < rampChance) {
      return {
        current: next, phase: "ramp",
        target: randomBetween(115, 138), ticksInPhase: 0,
        phaseDuration: Math.floor(randomBetween(8, 18)),
      };
    }
    return {
      current: next, phase: "baseline",
      target: randomBetween(BASELINE_MIN, BASELINE_MAX), ticksInPhase: 0,
      phaseDuration: Math.floor(randomBetween(5, 15)),
    };
  }

  if (phase === "spike") {
    // Brief plateau at peak before descending
    return {
      current: next, phase: "hold",
      target: next, ticksInPhase: 0,
      phaseDuration: Math.floor(randomBetween(3, 6)),
    };
  }

  if (phase === "ramp") {
    // Longer plateau before recovery
    return {
      current: next, phase: "hold",
      target: next, ticksInPhase: 0,
      phaseDuration: Math.floor(randomBetween(10, 20)),
    };
  }

  if (phase === "hold") {
    return {
      current: next, phase: "recovery",
      target: randomBetween(BASELINE_MIN, BASELINE_MAX), ticksInPhase: 0,
      phaseDuration: Math.floor(randomBetween(10, 20)),
    };
  }

  // recovery → baseline
  return {
    current: next, phase: "baseline",
    target: randomBetween(BASELINE_MIN, BASELINE_MAX), ticksInPhase: 0,
    phaseDuration: Math.floor(randomBetween(8, 20)),
  };
}

// Immediately steer the state machine toward the commanded event
function applyOverride(cmd: OverrideCmd, s: State): State {
  switch (cmd) {
    case "spike":
      return {
        ...s, phase: "spike",
        target: randomBetween(155, 165),
        ticksInPhase: 0, phaseDuration: Math.floor(randomBetween(4, 6)),
      };
    case "ramp": {
      const rampTarget = clamp(s.current + randomBetween(25, 40), 90, 185);
      return {
        ...s, phase: "ramp",
        target: rampTarget,
        ticksInPhase: 0, phaseDuration: Math.floor(randomBetween(15, 25)),
      };
    }
    case "cancel":
      return {
        ...s, phase: "recovery",
        target: randomBetween(BASELINE_MIN, BASELINE_MAX),
        ticksInPhase: 0, phaseDuration: Math.floor(randomBetween(8, 15)),
      };
    // Quick +20-30 from current position
    case "bump": {
      const bumpTarget = clamp(s.current + randomBetween(20, 30), 80, 185);
      return {
        ...s, phase: "spike",
        target: bumpTarget,
        ticksInPhase: 0, phaseDuration: Math.floor(randomBetween(4, 7)),
      };
    }
    // Force directly into UNFILTERED RAGE territory
    case "rage":
      return {
        ...s, phase: "spike",
        current: 152,
        target: randomBetween(155, 165),
        ticksInPhase: 0, phaseDuration: 2,
      };
    // Fast drop ~20 bpm — triggers cooldown detection
    case "drop": {
      const dropTarget = clamp(s.current - randomBetween(18, 28), 55, s.current - 15);
      return {
        ...s, phase: "recovery",
        target: dropTarget,
        ticksInPhase: 0, phaseDuration: Math.floor(randomBetween(5, 8)),
      };
    }
    default:
      return s;
  }
}

function freshState(): State {
  return {
    current:       randomBetween(BASELINE_MIN, BASELINE_MAX),
    phase:         "baseline",
    target:        randomBetween(BASELINE_MIN, BASELINE_MAX),
    ticksInPhase:  0,
    phaseDuration: 10,
  };
}

export interface FakeHeartRateControls {
  points:  HeartRatePoint[];
  trigger: (cmd: OverrideCmd) => void;
}

/**
 * @param active       Whether a session is in progress.
 * @param dbLevelRef   Optional ref kept updated by the caller with the latest
 *                     normalized mic level (0–100), or null when unavailable.
 *                     Read once per tick so BPM and loudness share a timeline.
 */
export function useFakeHeartRate(
  active:      boolean,
  dbLevelRef?: RefObject<number | null>,
): FakeHeartRateControls {
  const [points, setPoints] = useState<HeartRatePoint[]>([]);
  const stateRef            = useRef<State>(freshState());
  const overrideCmdRef      = useRef<OverrideCmd>(null);

  /** Queue a simulation command; consumed on the next tick. */
  const trigger = useCallback((cmd: OverrideCmd) => {
    overrideCmdRef.current = cmd;
  }, []);

  // ── Tick loop (only while session is active) ──────────────────────────────
  useEffect(() => {
    if (!active) return;

    setPoints([]);
    stateRef.current       = freshState();
    overrideCmdRef.current = null;

    const interval = setInterval(() => {
      const cmd = overrideCmdRef.current;
      if (cmd !== null) {
        stateRef.current       = applyOverride(cmd, stateRef.current);
        overrideCmdRef.current = null;
      } else {
        stateRef.current = nextState(stateRef.current, false);
      }
      const bpm     = Math.round(stateRef.current.current);
      const dbLevel = dbLevelRef?.current ?? null;
      setPoints((prev) => [...prev, { timestamp: Date.now(), bpm, dbLevel }]);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [active, dbLevelRef]);

  return { points, trigger };
}
