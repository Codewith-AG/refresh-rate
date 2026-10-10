/**
 * Refresh Rate Test — client-side measurement engine.
 *
 * Measures the display refresh rate by timing requestAnimationFrame callbacks
 * with performance.now(). All computation happens in the browser; nothing is
 * ever uploaded.
 *
 * Accuracy notes (surfaced in the UI): the browser renders in sync with the
 * display the window is on. The value can be capped by browser VSYNC / OS
 * compositing, and background tabs are throttled by the browser — so we guard
 * against hidden tabs and discard outlier/pause intervals.
 */

export interface RefreshSample {
  /** Instantaneous Hz from the most recent (smoothed) frame interval. */
  currentHz: number;
  /** Robust rolling-average Hz over the measurement window. */
  averageHz: number;
  /** Highest stable Hz observed this session. */
  maxHz: number;
  /** Lowest stable Hz observed this session. */
  minHz: number;
  /** Frame-pacing stability, 0–100 (100 = perfectly even frames). */
  stability: number;
  /** Nearest common panel rate if the average snaps to one, else null. */
  nearestStandard: number | null;
  /** Count of likely dropped / skipped frames this session. */
  droppedFrames: number;
  /** Total counted frames this session. */
  frameCount: number;
  /** Milliseconds of counted measurement time. */
  elapsedMs: number;
  /** Recent per-frame intervals (ms) for the graph. */
  frameTimesMs: number[];
  /** Whether the loop is actively measuring. */
  running: boolean;
  /** Whether the tab is currently hidden (measurement paused). */
  hidden: boolean;
  /** True once enough samples exist for a trustworthy reading. */
  settled: boolean;
}

export interface RefreshRateOptions {
  /** Called on every animation frame with the latest sample. */
  onSample?: (sample: RefreshSample) => void;
  /** Rolling window length in ms for the average. Default 1000. */
  windowMs?: number;
  /** How many recent frame-times to retain for the graph. Default 240. */
  graphSamples?: number;
}

/** Common panel refresh rates we snap to. */
export const STANDARD_RATES = [
  24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 280, 300,
  360, 390, 480, 500, 540,
] as const;

/** Any interval longer than this (ms) is treated as a pause, not a frame. */
const PAUSE_THRESHOLD_MS = 250;
/** Minimum sane interval (ms) — guards against duplicate timestamps (>1000Hz). */
const MIN_INTERVAL_MS = 1;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Snap a measured rate to the nearest standard rate within tolerance (%). */
export function snapToStandard(hz: number, tolerance = 0.04): number | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const rate of STANDARD_RATES) {
    const diff = Math.abs(rate - hz) / rate;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = rate;
    }
  }
  return best !== null && bestDiff <= tolerance ? best : null;
}

/** Format a Hz value for display (two decimals, trims noise). */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return "—";
  return hz.toFixed(2);
}

export class RefreshRateMeter {
  private readonly onSample?: (sample: RefreshSample) => void;
  private readonly windowMs: number;
  private readonly graphSamples: number;

  private rafId = 0;
  private running = false;
  private hidden = false;
  private lastTs = 0;
  private skipNextDelta = true;

  // Rolling window of recent frame intervals: [timestamp, deltaMs]
  private window: Array<{ t: number; d: number }> = [];
  private graph: number[] = [];

  private frameCount = 0;
  private elapsedMs = 0;
  private droppedFrames = 0;
  private maxHz = 0;
  private minHz = Infinity;
  private settleFramesLeft = 20;

  private readonly onVisibility = () => {
    this.hidden = document.hidden;
    // Discard the first interval after returning — it spans the hidden gap.
    if (!document.hidden) this.skipNextDelta = true;
  };

  constructor(options: RefreshRateOptions = {}) {
    this.onSample = options.onSample;
    this.windowMs = options.windowMs ?? 1000;
    this.graphSamples = options.graphSamples ?? 240;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.skipNextDelta = true;
    this.lastTs = performance.now();
    document.addEventListener("visibilitychange", this.onVisibility);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.emit();
  }

  reset(): void {
    this.window = [];
    this.graph = [];
    this.frameCount = 0;
    this.elapsedMs = 0;
    this.droppedFrames = 0;
    this.maxHz = 0;
    this.minHz = Infinity;
    this.settleFramesLeft = 20;
    this.skipNextDelta = true;
    this.lastTs = performance.now();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;

    const delta = now - this.lastTs;
    this.lastTs = now;

    // Ignore the first frame after start/resume, and any pause-length gaps.
    if (this.skipNextDelta || delta > PAUSE_THRESHOLD_MS) {
      this.skipNextDelta = false;
    } else if (delta >= MIN_INTERVAL_MS) {
      this.record(delta, now);
    }

    this.emit();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private record(delta: number, now: number): void {
    this.frameCount += 1;
    this.elapsedMs += delta;

    // Graph buffer.
    this.graph.push(delta);
    if (this.graph.length > this.graphSamples) this.graph.shift();

    // Rolling window.
    this.window.push({ t: now, d: delta });
    const cutoff = now - this.windowMs;
    while (this.window.length > 0 && this.window[0].t < cutoff) {
      this.window.shift();
    }

    // Dropped-frame detection: an interval ~2x the median = a missed vsync.
    const med = median(this.window.map((w) => w.d));
    if (med > 0 && delta > med * 1.8) {
      this.droppedFrames += 1;
    }

    if (this.settleFramesLeft > 0) this.settleFramesLeft -= 1;
  }

  private emit(): void {
    const deltas = this.window.map((w) => w.d);
    const med = median(deltas);
    const currentHz = med > 0 ? 1000 / med : 0;

    // Robust average: use the median interval over the window.
    const averageHz = currentHz;

    // Stability: inverse of coefficient of variation, mapped to 0–100.
    let stability = 0;
    if (deltas.length > 2 && med > 0) {
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const variance =
        deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
      const cv = Math.sqrt(variance) / mean;
      stability = Math.max(0, Math.min(100, Math.round((1 - cv * 4) * 100)));
    }

    const settled = this.settleFramesLeft <= 0 && deltas.length > 5;

    // Track stable max/min only once settled, to avoid startup noise.
    if (settled && Number.isFinite(averageHz) && averageHz > 0) {
      if (averageHz > this.maxHz) this.maxHz = averageHz;
      if (averageHz < this.minHz) this.minHz = averageHz;
    }

    const sample: RefreshSample = {
      currentHz,
      averageHz,
      maxHz: this.maxHz,
      minHz: this.minHz === Infinity ? 0 : this.minHz,
      stability,
      nearestStandard: snapToStandard(averageHz),
      droppedFrames: this.droppedFrames,
      frameCount: this.frameCount,
      elapsedMs: this.elapsedMs,
      frameTimesMs: this.graph,
      running: this.running,
      hidden: this.hidden,
      settled,
    };

    this.onSample?.(sample);
  }
}
