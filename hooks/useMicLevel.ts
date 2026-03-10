"use client";

import { useEffect, useRef, useState } from "react";

export interface MicLevelResult {
  /** Normalized loudness 0–100. */
  level:      number;
  permitted:  boolean;
  requesting: boolean;
}

/**
 * Maps RMS amplitude to a 0–100 scale via a log curve.
 * −45 dB → 0,  +5 dB → 100 (typical talk ≈ −28 dB → ~34).
 * Noise-gated below RMS 0.005 (~−46 dB) to suppress ambient mic noise.
 */
function rmsToLevel(rms: number): number {
  if (rms < 0.005) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(100, (db + 45) * 2));
}

export function useMicLevel(): MicLevelResult {
  const [level,      setLevel]      = useState(0);
  const [permitted,  setPermitted]  = useState(false);
  const [requesting, setRequesting] = useState(false);

  const smoothedRef    = useRef(0);
  const prevRoundedRef = useRef(-1);
  const rafRef         = useRef<number | null>(null);
  const cleanupRef     = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    let cancelled = false;
    setRequesting(true);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        const context  = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize               = 1024;
        analyser.smoothingTimeConstant = 0;
        context.createMediaStreamSource(stream).connect(analyser);

        setPermitted(true);
        setRequesting(false);

        // Store teardown so the effect cleanup can call it even after async gap
        cleanupRef.current = () => {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          stream.getTracks().forEach((t) => t.stop());
          context.close();
        };

        const buf = new Float32Array(analyser.fftSize);

        function tick() {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const raw = rmsToLevel(rms);

          // Fast attack, slow release
          const prev = smoothedRef.current;
          const next = raw > prev
            ? prev * 0.3  + raw * 0.7   // fast rise
            : prev * 0.82 + raw * 0.18; // slow fall
          smoothedRef.current = next;

          const rounded = Math.round(next);
          if (rounded !== prevRoundedRef.current) {
            prevRoundedRef.current = rounded;
            setLevel(rounded);
          }

          rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setRequesting(false);
          setPermitted(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return { level, permitted, requesting };
}
