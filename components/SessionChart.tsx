"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HeartRatePoint } from "@/hooks/useFakeHeartRate";
import { type ChartEvent, type ChartEventType } from "@/lib/chartEvents";

interface Props {
  points: HeartRatePoint[];
  events?: ChartEvent[];
  /** Container height in px. Defaults to 208 (h-52). */
  height?: number;
}

// ─── Event marker metadata ────────────────────────────────────────────────────

const EVENT_META: Record<
  ChartEventType,
  { label: string; stroke: string; textFill: string }
> = {
  peak:     { label: "Peak",     stroke: "rgba(240,237,232,0.22)", textFill: "rgba(240,237,232,0.50)" },
  redline:  { label: "Redline",  stroke: "rgba(232,112,90,0.25)",  textFill: "rgba(232,112,90,0.65)"  },
  meltdown: { label: "Meltdown", stroke: "rgba(255,59,32,0.35)",   textFill: "rgba(255,59,32,0.85)"   },
};

// When two markers land within this window, the higher-priority one wins.
const MIN_MARKER_GAP_MS = 6_000;
const MARKER_PRIORITY: Record<ChartEventType, number> = {
  meltdown: 3,
  peak:     2,
  redline:  1,
};

// ─── Zone gradient helpers ────────────────────────────────────────────────────

const ZONE_THRESHOLDS = [
  { bpm: 110, color: "#e8705a" }, // Redline / Bourbon boundary
  { bpm: 95,  color: "#e8b84d" }, // Locked In / Vibing boundary
  { bpm: 80,  color: "#5ab5e8" }, // Vibing / Chill boundary
] as const;

function zoneColor(bpm: number): string {
  if (bpm >= 110) return "#e8705a";
  if (bpm >= 95)  return "#e8b84d";
  if (bpm >= 80)  return "#5ab5e8";
  return "#7cc8a0";
}

/**
 * Y-gradient offset: 0% = top = dataMax, 100% = bottom = dataMin.
 * We compute stops against the actual data range (no axis padding) so the
 * gradient maps exactly to the path's bounding box when using objectBoundingBox.
 */
function yPct(bpm: number, dataMin: number, dataMax: number): number {
  return Math.min(Math.max(((dataMax - bpm) / (dataMax - dataMin)) * 100, 0), 100);
}

interface GradientStop {
  offset: string;
  color: string;
  strokeOpacity: number;
  fillOpacity: number;
}

function buildStops(dataMin: number, dataMax: number): GradientStop[] {
  const stops: GradientStop[] = [];

  // Top stop — color of the highest point
  stops.push({ offset: "0%", color: zoneColor(dataMax), strokeOpacity: 1, fillOpacity: 0.25 });

  // Zone threshold stops within the data range
  for (const z of ZONE_THRESHOLDS) {
    if (z.bpm > dataMin && z.bpm < dataMax) {
      const pct = yPct(z.bpm, dataMin, dataMax);
      stops.push({
        offset: `${pct.toFixed(2)}%`,
        color: z.color,
        strokeOpacity: 1,
        // Fill opacity linearly fades from ~0.20 at top to 0 at bottom
        fillOpacity: Math.max(0.20 * (1 - pct / 100), 0),
      });
    }
  }

  // Bottom stop — always calm / fully transparent fill
  stops.push({ offset: "100%", color: "#7cc8a0", strokeOpacity: 1, fillOpacity: 0 });

  return stops;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  // payload entries keyed by Area dataKey
  payload?: Array<{ name: string; value: number | null; payload: { label: string } }>;
}) => {
  if (!active || !payload?.length) return null;
  // Locate by dataKey name so order of Areas in JSX doesn't matter
  const bpmEntry = payload.find((p) => p.name === "bpm");
  if (!bpmEntry || bpmEntry.value === null) return null;
  const bpm      = bpmEntry.value;
  const color    = zoneColor(bpm);
  const dbEntry  = payload.find((p) => p.name === "db");
  const dbValue  = dbEntry?.value ?? null;
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "#272521",
        border:     "1px solid rgba(240,237,232,0.1)",
        boxShadow:  "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p
        className="font-bold tabular-nums text-base leading-none"
        style={{
          color,
          fontFamily:    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {bpm}{" "}
        <span className="text-xs font-medium" style={{ color: "rgba(240,237,232,0.4)" }}>
          bpm
        </span>
      </p>
      {dbValue !== null && (
        <p
          className="tabular-nums"
          style={{ fontSize: 10, color: "rgba(0,210,190,0.65)", marginTop: "3px" }}
        >
          voice {Math.round(dbValue)}
        </p>
      )}
      <p className="text-xs mt-1.5" style={{ color: "rgba(240,237,232,0.3)" }}>
        {bpmEntry.payload.label}
      </p>
    </div>
  );
};

// ─── Chart ───────────────────────────────────────────────────────────────────

function formatElapsed(ts: number, startTs: number) {
  const s  = Math.floor((ts - startTs) / 1000);
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export default function SessionChart({ points, events = [], height = 208 }: Props) {
  const uid      = useId();
  const strokeId = `strokeGrad-${uid}`;
  const fillId   = `fillGrad-${uid}`;
  const dbFillId = `dbFillGrad-${uid}`;

  const startTs = points[0]?.timestamp ?? Date.now();

  const data = points.map((p) => ({
    ts:    p.timestamp,
    bpm:   p.bpm,
    // null preserved so Recharts creates a visual gap when mic is unavailable
    db:    p.dbLevel,
    label: formatElapsed(p.timestamp, startTs),
  }));

  if (data.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ height, color: "rgba(240,237,232,0.18)" }}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 opacity-40"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
        <span className="text-sm tracking-wide">Collecting data…</span>
      </div>
    );
  }

  const allBpms = data.map((d) => d.bpm);
  const dataMin = Math.min(...allBpms);
  const dataMax = Math.max(...allBpms);

  // Y axis domain with breathing room
  const axisDomainMin = Math.max(40,  dataMin - 12);
  const axisDomainMax = Math.min(220, dataMax + 12);

  // Clean ticks at every 20 bpm, filtered to the visible range
  const Y_TICK_STEP = 20;
  const yTicks: number[] = [];
  const firstTick = Math.ceil(axisDomainMin / Y_TICK_STEP) * Y_TICK_STEP;
  for (let t = firstTick; t <= axisDomainMax; t += Y_TICK_STEP) {
    yTicks.push(t);
  }

  // Gradient stops calculated from the actual data range
  const stops = buildStops(dataMin, dataMax);

  // X-axis ticks: one every 30 s, computed from startTs directly
  // so they always land on clean 0:30, 1:00, 1:30… boundaries
  const lastTs = data[data.length - 1].ts;
  const xTicks: number[] = [];
  for (let offset = 30_000; startTs + offset <= lastTs; offset += 30_000) {
    xTicks.push(startTs + offset);
  }

  // Priority-based deduplication: when two markers fall within MIN_MARKER_GAP_MS
  // of each other, the higher-priority type wins (meltdown > peak > redline).
  const visibleMarkers: ChartEvent[] = [];
  for (const e of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    const closeIdx = visibleMarkers.findIndex(
      (m) => Math.abs(m.timestamp - e.timestamp) < MIN_MARKER_GAP_MS
    );
    if (closeIdx === -1) {
      visibleMarkers.push(e);
    } else if (MARKER_PRIORITY[e.type] > MARKER_PRIORITY[visibleMarkers[closeIdx].type]) {
      visibleMarkers[closeIdx] = e; // replace with higher-priority marker
    }
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
          <defs>
            {/* Stroke gradient — full opacity zone colors */}
            <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
              {stops.map((s, i) => (
                <stop
                  key={`s${i}`}
                  offset={s.offset}
                  stopColor={s.color}
                  stopOpacity={s.strokeOpacity}
                />
              ))}
            </linearGradient>

            {/* Fill gradient — same zone colors fading to transparent */}
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              {stops.map((s, i) => (
                <stop
                  key={`f${i}`}
                  offset={s.offset}
                  stopColor={s.color}
                  stopOpacity={s.fillOpacity}
                />
              ))}
            </linearGradient>

            {/* dB activity strip — teal, fades from peak edge down to baseline */}
            <linearGradient id={dbFillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgb(0,220,200)" stopOpacity={0.50} />
              <stop offset="100%" stopColor="rgb(0,180,160)" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(240,237,232,0.04)"
            vertical={false}
          />

          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={xTicks}
            tickFormatter={(v) => formatElapsed(v, startTs)}
            tick={{ fill: "rgba(240,237,232,0.22)", fontSize: 10, fontFamily: "inherit" }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            domain={[axisDomainMin, axisDomainMax]}
            ticks={yTicks}
            tick={{ fill: "rgba(240,237,232,0.22)", fontSize: 10, fontFamily: "inherit" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          {/* Hidden axis for dB strip — domain intentionally large so max loudness
              only occupies ~12% of chart height, keeping HR the dominant signal */}
          <YAxis yAxisId="db" domain={[0, 800]} hide width={0} />

          {/* 110 bpm redline threshold */}
          {axisDomainMax >= 100 && (
            <ReferenceLine
              y={110}
              stroke="rgba(232,112,90,0.25)"
              strokeDasharray="4 4"
              label={{
                value:    "110",
                position: "insideTopRight",
                fill:     "rgba(232,112,90,0.35)",
                fontSize: 10,
              }}
            />
          )}

          {/* Session event markers — alternate label sides so adjacent ones never overlap */}
          {visibleMarkers.map((e, idx) => {
            const m        = EVENT_META[e.type];
            const position = idx % 2 === 0 ? "insideTopLeft" : "insideTopRight";
            return (
              <ReferenceLine
                key={`${e.type}-${e.timestamp}`}
                x={e.timestamp}
                stroke={m.stroke}
                strokeDasharray="2 3"
                strokeWidth={1}
                label={{
                  value:    m.label,
                  position,
                  fill:     m.textFill,
                  fontSize: 9,
                }}
              />
            );
          })}

          <Tooltip content={<CustomTooltip />} />

          {/* dB activity strip — rendered first so it sits behind the HR line */}
          <Area
            yAxisId="db"
            type="monotoneX"
            dataKey="db"
            stroke="rgba(0,200,180,0.22)"
            strokeWidth={0.5}
            fill={`url(#${dbFillId})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />

          <Area
            type="monotoneX"
            dataKey="bpm"
            stroke={`url(#${strokeId})`}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={(props: Record<string, unknown>) => {
              const bpm   = props.value as number;
              const color = zoneColor(bpm);
              return (
                <circle
                  cx={props.cx as number}
                  cy={props.cy as number}
                  r={4}
                  fill={color}
                  stroke={`${color}55`}
                  strokeWidth={5}
                />
              );
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
