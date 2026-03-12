"use client";

import { useEffect, useRef, useState } from "react";
import {
  type HeartZone,
  ZONE_CONFIG,
  ZONE_MESSAGES,
  getRawIntensity,
  applyHysteresis,
} from "@/lib/zones";

// ─── SVG Ring math ───────────────────────────────────────────────────────────

const CX = 120;
const CY = 120;
const R  = 96;
const STROKE      = 9;
const START_ANGLE = 135;
const TOTAL_SWEEP = 270;
const BPM_MIN     = 40;
const BPM_MAX     = 200;
const DEBOUNCE_TICKS = 2;

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function polarPoint(angleDeg: number) {
  return {
    x: CX + R * Math.cos(toRad(angleDeg)),
    y: CY + R * Math.sin(toRad(angleDeg)),
  };
}

function arcPath(startAngle: number, sweepDeg: number): string {
  if (sweepDeg <= 0) return "";
  const clamped = Math.min(sweepDeg, 359.99);
  const start   = polarPoint(startAngle);
  const end     = polarPoint(startAngle + clamped);
  const large   = clamped > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

// ─── Flame ───────────────────────────────────────────────────────────────────

function FlameEffect({ opacity, insane }: { opacity: number; insane: boolean }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        opacity,
        // Extend beyond the ring so flames aren't clipped at the edges
        inset: insane ? "-32px" : "-12px",
      }}
    >
      <div className="flame-outer" />
      <div className="flame-mid"   />
      <div className="flame-inner" />
      {insane && <div className="flame-insanity-outer" />}
      {insane && <div className="flame-insanity-mid"   />}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BpmHero({ bpm }: { bpm: number }) {

  // ── Debounced + hysteretic intensity ──────────────────────────────────────
  const pendingIntensityRef    = useRef<HeartZone>(getRawIntensity(bpm || BPM_MIN));
  const stableTicksRef         = useRef(0);
  const displayedIntensityRef  = useRef<HeartZone>(getRawIntensity(bpm || BPM_MIN));
  const [displayedIntensity, setDisplayedIntensity] = useState<HeartZone>(
    getRawIntensity(bpm || BPM_MIN)
  );

  useEffect(() => {
    if (bpm === 0) {
      pendingIntensityRef.current   = "Chill";
      stableTicksRef.current        = 0;
      displayedIntensityRef.current = "Chill";
      setDisplayedIntensity("Chill");
      return;
    }
    const raw = applyHysteresis(
      getRawIntensity(bpm),
      displayedIntensityRef.current,
      bpm
    );
    if (raw === pendingIntensityRef.current) {
      stableTicksRef.current++;
      if (
        stableTicksRef.current >= DEBOUNCE_TICKS &&
        raw !== displayedIntensityRef.current
      ) {
        displayedIntensityRef.current = raw;
        setDisplayedIntensity(raw);
      }
    } else {
      pendingIntensityRef.current = raw;
      stableTicksRef.current      = 1;
    }
  }, [bpm]);

  // ── Rotating sub-message ──────────────────────────────────────────────────
  const [subMsgIdx, setSubMsgIdx] = useState(0);
  const subMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (subMsgTimerRef.current) clearTimeout(subMsgTimerRef.current);
    const messages = ZONE_MESSAGES[displayedIntensity];
    let idx = Math.floor(Math.random() * messages.length);
    setSubMsgIdx(idx);
    function scheduleNext() {
      const delay = 12000 + Math.random() * 6000; // 12–18 s
      subMsgTimerRef.current = setTimeout(() => {
        idx = (idx + 1) % messages.length;
        setSubMsgIdx(idx);
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => { if (subMsgTimerRef.current) clearTimeout(subMsgTimerRef.current); };
  }, [displayedIntensity]);

  // ── Session peak callout ───────────────────────────────────────────────────
  const sessionPeakRef        = useRef(0);
  const peakTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPeakCallout, setShowPeakCallout] = useState(false);

  useEffect(() => {
    if (bpm === 0) {
      sessionPeakRef.current = 0;
      return;
    }
    if (bpm > sessionPeakRef.current) {
      sessionPeakRef.current = bpm;
      setShowPeakCallout(true);
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current);
      peakTimerRef.current = setTimeout(() => setShowPeakCallout(false), 600);
    }
  }, [bpm]);

  // ── Cooling down detection ────────────────────────────────────────────────
  // Tracks a rolling 10-tick BPM history. Triggers "Cooling Down" once when
  // BPM drops ≥12 within ~8 seconds after a heated moment (was ≥110).
  const bpmHistoryRef          = useRef<number[]>([]);
  const cooldownActiveRef      = useRef(false);
  const cooldownTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCooldownTriggerRef = useRef(0);
  const [showCoolDown, setShowCoolDown] = useState(false);

  useEffect(() => {
    if (bpm === 0) {
      bpmHistoryRef.current = [];
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      cooldownActiveRef.current = false;
      setShowCoolDown(false);
      return;
    }
    const hist = bpmHistoryRef.current;
    hist.push(bpm);
    if (hist.length > 10) hist.shift();

    if (cooldownActiveRef.current || hist.length < 8) return;
    const bpm8sAgo = hist[hist.length - 8];
    const now = Date.now();
    if (
      bpm8sAgo >= 110 &&
      bpm8sAgo - bpm >= 12 &&
      now - lastCooldownTriggerRef.current >= 15_000
    ) {
      lastCooldownTriggerRef.current = now;
      cooldownActiveRef.current = true;
      setShowCoolDown(true);
      cooldownTimerRef.current = setTimeout(() => {
        setShowCoolDown(false);
        cooldownActiveRef.current = false;
      }, 2500);
    }
  }, [bpm]);

  // ── Derived display values ─────────────────────────────────────────────────
  const meta       = ZONE_CONFIG[displayedIntensity];
  const isHot      = displayedIntensity === "BourbonIsNecessary" || displayedIntensity === "UnfilteredRage";
  const isInsanity = displayedIntensity === "UnfilteredRage";

  // Continuous (non-debounced) scaling — drives smooth glow + flame
  const globalIntensity = Math.min(Math.max((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN), 0), 1);
  const flameIntensity  = isHot ? Math.min(Math.max((bpm - 110) / 40, 0), 1) : 0;
  const glowOpacity     = 0.06 + globalIntensity * 0.52;
  const glowBlur        = 24 + globalIntensity * 28;

  // ── Number tween ──────────────────────────────────────────────────────────
  const displayRef = useRef(bpm || BPM_MIN);
  const [display, setDisplay] = useState(bpm || BPM_MIN);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (bpm === 0) return;
    const target = bpm;
    let last = performance.now();
    function tick(now: number) {
      const delta = (now - last) / 1000;
      last = now;
      const diff = target - displayRef.current;
      displayRef.current += diff * Math.min(delta * 9, 1);
      setDisplay(Math.round(displayRef.current));
      if (Math.abs(diff) > 0.4) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [bpm]);

  // Arc from tweened display value
  const progress     = Math.min(Math.max((display - BPM_MIN) / (BPM_MAX - BPM_MIN), 0), 1);
  const sweep        = progress * TOTAL_SWEEP;
  const trackPath    = arcPath(START_ANGLE, TOTAL_SWEEP);
  const progressPath = arcPath(START_ANGLE, Math.max(sweep, 1));
  const endPt        = polarPoint(START_ANGLE + sweep);

  return (
    <div className="flex flex-col items-center gap-1 py-6">

      {/* Ring + number ---------------------------------------------------- */}
      <div className="relative w-[260px] h-[260px] flex items-center justify-center">

        {/* Ambient glow */}
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            inset:      `${Math.max(20 - Math.floor(globalIntensity * 14), 4)}px`,
            background: `rgba(${meta.rgb}, 1)`,
            opacity:    glowOpacity,
            filter:     `blur(${glowBlur}px)`,
          }}
        />

        {/* Flames (Extreme + Insanity) */}
        {isHot && (
          <FlameEffect
            opacity={isInsanity ? 0.85 + flameIntensity * 0.15 : 0.45 + flameIntensity * 0.4}
            insane={isInsanity}
          />
        )}

        {/* Peak callout — inner radial flash */}
        {showPeakCallout && (
          <div
            className="absolute rounded-full animate-peak-flash pointer-events-none"
            style={{
              inset:      "28px",
              background: `radial-gradient(circle, rgba(${meta.rgb},0.55) 0%, transparent 72%)`,
            }}
          />
        )}

        {/* SVG ring */}
        <svg
          viewBox="0 0 240 240"
          className="absolute inset-0 w-full h-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient
              id="arcGrad"
              gradientUnits="userSpaceOnUse"
              x1="40" y1="220" x2="200" y2="20"
            >
              <stop offset="0%"   stopColor={meta.color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={meta.color} stopOpacity={1}   />
            </linearGradient>
          </defs>

          <path
            d={trackPath}
            fill="none"
            stroke="rgba(240,237,232,0.07)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {sweep > 0.5 && (
            <path
              d={progressPath}
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          )}
          {sweep > 2 && (
            <circle
              cx={endPt.x}
              cy={endPt.y}
              r={STROKE / 2 + 1.5}
              fill={meta.color}
              style={{ filter: `drop-shadow(0 0 ${6 + flameIntensity * 8}px ${meta.color})` }}
            />
          )}
        </svg>

        {/* Center: number + unit */}
        <div
          className="relative flex flex-col items-center select-none z-10"
          style={{ marginTop: "-10px" }}
        >
          <span
            className="font-black leading-none tabular-nums"
            style={{
              fontSize:      "clamp(3.8rem, 15vw, 5.5rem)",
              letterSpacing: "-0.04em",
              fontFamily:    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              color:         bpm === 0 ? "rgba(240,237,232,0.15)" : "#f0ede8",
              textShadow:    isHot
                ? `0 0 ${20 + flameIntensity * 30}px rgba(${meta.rgb}, ${0.4 + flameIntensity * 0.4})`
                : "none",
              transition: "color 0.8s ease, text-shadow 0.8s ease",
            }}
          >
            {bpm === 0 ? "—" : display}
          </span>
          <span
            className="text-xs tracking-[0.18em] uppercase font-medium mt-1"
            style={{ color: "rgba(240,237,232,0.28)" }}
          >
            bpm
          </span>
        </div>
      </div>

      {/* Zone label — two lines for Extreme/Insanity, one line otherwise ----- */}
      <div className="flex flex-col items-center gap-0.5 min-h-[2.5rem] justify-center">
        <span
          className="text-sm font-medium tracking-wide transition-colors duration-700"
          style={{ color: bpm === 0 ? "rgba(240,237,232,0.25)" : meta.color }}
        >
          {bpm === 0 ? "Waiting…" : meta.label}
        </span>
        {meta.category && bpm > 0 && (
          <span
            className="text-[10px] tracking-[0.18em] uppercase font-semibold transition-colors duration-700"
            style={{ color: `rgba(${meta.rgb}, 0.6)` }}
          >
            {meta.category}
          </span>
        )}
        {/* Rotating sub-message / Cooling Down override */}
        <span
          className="text-xs tracking-wide mt-0.5"
          style={{
            color:      showCoolDown ? "rgba(90,181,232,0.75)" : "rgba(240,237,232,0.5)",
            minHeight:  "1rem",
            transition: "color 0.4s ease",
          }}
        >
          {bpm > 0 ? (showCoolDown ? "Cooling Down" : ZONE_MESSAGES[displayedIntensity][subMsgIdx]) : ""}
        </span>
      </div>

      {/* New session peak callout — always in flow, opacity-only transition */}
      <span
        className="text-[10px] tracking-[0.2em] uppercase font-semibold"
        style={{
          color:      "rgba(240,237,232,0.5)",
          opacity:    showPeakCallout ? 1 : 0,
          transition: showPeakCallout ? "none" : "opacity 0.4s ease",
        }}
      >
        New Session Peak
      </span>
    </div>
  );
}
