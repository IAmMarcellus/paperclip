import { useEffect, useRef, type RefObject } from "react";
import { cn } from "../lib/utils";

/**
 * The live state that drives the nebula. The parent (OversightCall) updates the
 * ref every render with thin, throwing-safe accessors over the ElevenLabs
 * conversation; the canvas reads them once per animation frame so audio
 * reactivity never triggers a React re-render.
 */
export type NebulaState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface NebulaAudio {
  state: NebulaState;
  /** Output (Mergatroid) voice spectrum, 0-255 bins. Empty when disconnected. */
  getOutputFreq: () => Uint8Array;
  /** Output (Mergatroid) loudness, 0-1. */
  getOutputVolume: () => number;
  /** Input (your mic) loudness, 0-1 — drives the calmer "listening" state. */
  getInputVolume: () => number;
}

/** Shared "no frequency data" sentinel (reused by callers' throw-guards). */
export const EMPTY = new Uint8Array(0);

/** A safe idle audio source (used as the initial ref value before a call). */
export function idleNebulaAudio(): NebulaAudio {
  return {
    state: "idle",
    getOutputFreq: () => EMPTY,
    getOutputVolume: () => 0,
    getInputVolume: () => 0,
  };
}

/** Module singleton for the per-frame fallback — avoids allocating an object +
 *  3 closures on any frame where `audioRef.current` is momentarily null. */
const IDLE_AUDIO = idleNebulaAudio();

// Brand anchor colors as "r,g,b" — mirror the dark-only theme tokens in index.css
// (--background/--teal/--emerald/--indigo/--rose). Kept in sync here on purpose: a
// per-frame getComputedStyle read isn't worth it for a fixed dark palette. The
// procedural node/edge/veil hues below stay generative (hsla), not tokens.
const BG_RGB = "8,8,10"; // --background  #08080a
const TEAL_RGB = "94,234,212"; // --teal
const EMERALD_RGB = "52,211,153"; // --emerald
const INDIGO_RGB = "129,140,248"; // --indigo
const ROSE_RGB = "251,113,133"; // --rose  #fb7185
const CORE_RGB = "232,80,180"; // hot magenta core (procedural, no token)

// ---- tunables ----------------------------------------------------------------
const NODE_COUNT = 150;
const BANDS = 48;
const EDGE_DIST_FRAC = 0.14; // proximity radius for plexus edges, as a frac of min(w,h)
const PARTICLE_COUNT = 110;
const THINK_HUE = 236; // indigo target the whole cloud shifts toward while "thinking"

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Per-state visual constants, in one place. `render()` reads this; only the
 *  dynamic `target` (audio level / thinking pulse) is computed in code. */
const STATE_VIS: Record<NebulaState, { baseGlow: number; sBright: number; stateAmp: number }> = {
  idle: { baseGlow: 0.18, sBright: 0.38, stateAmp: 0.16 },
  connecting: { baseGlow: 0.26, sBright: 0.45, stateAmp: 0.25 },
  listening: { baseGlow: 0.3, sBright: 0.5, stateAmp: 0.45 },
  thinking: { baseGlow: 0.34, sBright: 0.58, stateAmp: 0.5 },
  speaking: { baseGlow: 0.42, sBright: 0.7, stateAmp: 1 },
};

interface NebulaNode {
  /** Base unit-cloud coordinates (cos/sin·rad), precomputed — never change. */
  bx: number;
  by: number;
  hue: number;
  size: number;
  band: number;
  dPhase: number;
  dSpeed: number;
  dAmp: number;
  dPhase2: number;
  dSpeed2: number;
  twPhase: number;
}

/** Deterministic-ish nodes laid out in an organic squashed spheroid. `Math.random`
 *  is only used here at init (browser-side), never per frame. */
function makeNodes(): NebulaNode[] {
  const nodes: NebulaNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.pow(Math.random(), 0.72); // sqrt-ish bias → fuller toward the core
    const bx = Math.cos(angle) * rad; // also the unit-space x used for the hue sweep
    const by = Math.sin(angle) * 0.82 * rad;
    // left = magenta (300) → right = green (120), with a little per-node jitter
    const hue = clamp(300 - ((bx + 1) / 2) * 180 + (Math.random() * 40 - 20), 115, 320);
    nodes.push({
      bx,
      by,
      hue,
      size: 1.0 + Math.random() * 2.6,
      band: Math.floor((angle / (Math.PI * 2)) * BANDS) % BANDS,
      dPhase: Math.random() * Math.PI * 2,
      dSpeed: 0.18 + Math.random() * 0.4,
      dAmp: 0.015 + Math.random() * 0.05,
      dPhase2: Math.random() * Math.PI * 2,
      dSpeed2: 0.15 + Math.random() * 0.35,
      twPhase: Math.random() * Math.PI * 2,
    });
  }
  return nodes;
}

interface Particle {
  a: number;
  r: number;
  hue: number;
  sp: number;
  ph: number;
  sz: number;
  tw: number;
}

/** Sparse drifting dust in a halo wider than the plexus core. */
function makeParticles(): Particle[] {
  const ps: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.55 + Math.pow(Math.random(), 0.6) * 1.05;
    ps.push({
      a,
      r,
      hue: clamp(300 - ((Math.cos(a) * r + 1) / 2) * 180 + (Math.random() * 60 - 30), 110, 330),
      sp: 0.05 + Math.random() * 0.25,
      ph: Math.random() * Math.PI * 2,
      sz: 0.4 + Math.random() * 1.6,
      tw: Math.random() * Math.PI * 2,
    });
  }
  return ps;
}

/** Small translucent triangles among mutually-close core nodes → crystalline facets. */
function makeFacets(nodes: NebulaNode[]): Array<[number, number, number, number]> {
  const facets: Array<[number, number, number, number]> = [];
  const core: number[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const n = nodes[i];
    if (n.bx * n.bx + n.by * n.by < 0.62 * 0.62) core.push(i);
  }
  const used = new Set<string>();
  for (const i of core) {
    if (facets.length >= 20) break;
    let b1 = -1;
    let b2 = -1;
    let d1 = 1e9;
    let d2 = 1e9;
    for (const j of core) {
      if (j === i) continue;
      const dx = nodes[i].bx - nodes[j].bx;
      const dy = nodes[i].by - nodes[j].by;
      const d = dx * dx + dy * dy;
      if (d < d1) {
        d2 = d1;
        b2 = b1;
        d1 = d;
        b1 = j;
      } else if (d < d2) {
        d2 = d;
        b2 = j;
      }
    }
    if (b1 >= 0 && b2 >= 0 && d2 < 0.085) {
      const key = [i, b1, b2].sort((a, b) => a - b).join(",");
      if (!used.has(key)) {
        used.add(key);
        facets.push([i, b1, b2, nodes[i].hue]);
      }
    }
  }
  return facets;
}

interface VeilSpec {
  h0: number;
  h1: number;
  tilt: number;
  rx: number;
  ry: number;
  a0: number;
  a1: number;
  lobes: number;
  undul: number;
  speed: number;
  phase: number;
  wf: number; // width as a fraction of R
}

/** Wrapping silk veils — open, tapered, translucent filled bands that sweep the
 *  cloud. Full-spectrum set (magenta → blue → cyan → green, plus warm accents). */
const VEIL_SPECS: VeilSpec[] = [
  { h0: 305, h1: 265, tilt: 0.2, rx: 0.98, ry: 0.62, a0: -0.4, a1: 3.8, lobes: 2.0, undul: 0.14, speed: 0.45, phase: 0.0, wf: 0.075 },
  { h0: 265, h1: 215, tilt: -0.5, rx: 0.88, ry: 0.8, a0: 0.8, a1: 5.0, lobes: 1.6, undul: 0.18, speed: 0.38, phase: 1.6, wf: 0.09 },
  { h0: 215, h1: 170, tilt: 0.7, rx: 1.08, ry: 0.56, a0: 2.2, a1: 6.4, lobes: 2.2, undul: 0.12, speed: 0.5, phase: 3.0, wf: 0.06 },
  { h0: 170, h1: 125, tilt: 1.2, rx: 0.76, ry: 0.88, a0: 3.0, a1: 7.0, lobes: 1.7, undul: 0.2, speed: 0.42, phase: 4.2, wf: 0.08 },
  { h0: 128, h1: 185, tilt: -0.2, rx: 1.04, ry: 0.52, a0: -1.0, a1: 3.0, lobes: 2.6, undul: 0.1, speed: 0.55, phase: 5.5, wf: 0.05 },
  { h0: 330, h1: 285, tilt: 1.7, rx: 0.66, ry: 0.76, a0: 1.0, a1: 5.6, lobes: 2.0, undul: 0.16, speed: 0.46, phase: 2.2, wf: 0.07 },
  { h0: 285, h1: 330, tilt: 0.45, rx: 0.92, ry: 0.68, a0: 2.5, a1: 6.8, lobes: 1.8, undul: 0.13, speed: 0.4, phase: 0.8, wf: 0.045 },
  { h0: 200, h1: 250, tilt: -0.9, rx: 1.0, ry: 0.6, a0: 0.2, a1: 4.4, lobes: 2.4, undul: 0.12, speed: 0.52, phase: 3.7, wf: 0.05 },
  { h0: 160, h1: 120, tilt: 0.95, rx: 0.82, ry: 0.7, a0: 1.8, a1: 6.0, lobes: 1.5, undul: 0.17, speed: 0.36, phase: 1.1, wf: 0.06 },
  { h0: 300, h1: 205, tilt: 0.0, rx: 1.06, ry: 0.46, a0: -0.8, a1: 3.4, lobes: 3.0, undul: 0.09, speed: 0.6, phase: 4.8, wf: 0.04 },
  { h0: 250, h1: 300, tilt: 1.35, rx: 0.7, ry: 0.82, a0: 2.0, a1: 6.6, lobes: 2.1, undul: 0.15, speed: 0.44, phase: 5.9, wf: 0.05 },
  { h0: 355, h1: 30, tilt: 0.55, rx: 0.94, ry: 0.58, a0: -0.6, a1: 3.2, lobes: 2.3, undul: 0.13, speed: 0.48, phase: 2.7, wf: 0.045 },
  { h0: 55, h1: 110, tilt: -0.35, rx: 0.98, ry: 0.64, a0: 1.4, a1: 5.4, lobes: 2.0, undul: 0.12, speed: 0.5, phase: 4.5, wf: 0.05 },
];

// Veil geometry has many per-point terms that are constant across frames (the
// base angle, the undulation phase bases, the tilt rotation, the width taper).
// Precompute them ONCE so the 13-veils × 65-points per-frame loop only does the
// genuinely time-varying trig (the undulation sin/cos).
const SILK_PTS = 64;
const SILK_ENV = new Float32Array(SILK_PTS + 1); // sin taper, fixed per index
for (let p = 0; p <= SILK_PTS; p++) SILK_ENV[p] = Math.sin((p / SILK_PTS) * Math.PI);

interface Veil extends VeilSpec {
  ct: number; // cos(tilt)
  st: number; // sin(tilt)
  ca: Float32Array; // cos(angle) per point
  sa: Float32Array; // sin(angle) per point
  ph1: Float32Array; // undulation phase base for rxx
  ph2: Float32Array; // undulation phase base for ryy
}

const VEILS: Veil[] = VEIL_SPECS.map((s) => {
  const ca = new Float32Array(SILK_PTS + 1);
  const sa = new Float32Array(SILK_PTS + 1);
  const ph1 = new Float32Array(SILK_PTS + 1);
  const ph2 = new Float32Array(SILK_PTS + 1);
  for (let p = 0; p <= SILK_PTS; p++) {
    const u = p / SILK_PTS;
    const ang = lerp(s.a0, s.a1, u);
    ca[p] = Math.cos(ang);
    sa[p] = Math.sin(ang);
    ph1[p] = u * Math.PI * s.lobes;
    ph2[p] = u * Math.PI * s.lobes * 0.7;
  }
  return { ...s, ct: Math.cos(s.tilt), st: Math.sin(s.tilt), ca, sa, ph1, ph2 };
});

interface HexCell {
  x: number;
  y: number;
  s: number;
}

/** A honeycomb patch wrapping the lower-right of the cloud (unit space). */
function makeHexCells(): HexCell[] {
  const cells: HexCell[] = [];
  const cols = 7;
  const rows = 5;
  const s = 0.13;
  const ox = 0.3;
  const oy = 0.34;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const x = ox + q * 1.5 * s * 0.5;
      const y = oy + (r * Math.sqrt(3) * s + (q % 2) * Math.sqrt(3) * s * 0.5) * 0.5 - rows * s * 0.4;
      const dx = x - ox;
      const dy = y - oy;
      if (dx * dx + dy * dy > 0.42 * 0.42) continue; // clip to a disc
      cells.push({ x, y, s: s * 0.5 });
    }
  }
  return cells;
}
const HEX_CELLS = makeHexCells();

// Hexagon vertex directions are 7 fixed angles — precompute once, not per cell per frame.
const HEX_VCOS = new Float32Array(7);
const HEX_VSIN = new Float32Array(7);
for (let kk = 0; kk <= 6; kk++) {
  const a = (Math.PI / 3) * kk + 0.5;
  HEX_VCOS[kk] = Math.cos(a);
  HEX_VSIN[kk] = Math.sin(a);
}

interface NebulaCanvasProps {
  audioRef: RefObject<NebulaAudio>;
  className?: string;
}

/**
 * Audio-reactive "digital nebula" — a glowing neon plexus brain wrapped in
 * flowing translucent silk veils, with a hot core, crystalline facets, a
 * honeycomb patch, drifting dust, and side waveform ribbons, rendered on a
 * single Canvas 2D surface with additive ("lighter") compositing. Pauses when
 * the tab is hidden and renders a single static frame under
 * `prefers-reduced-motion`.
 */
export function NebulaCanvas({ audioRef, className }: NebulaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    // Explicit non-null type so the nested draw closures keep the narrowing
    // (control-flow narrowing doesn't cross function boundaries).
    const c: CanvasRenderingContext2D = ctx2d;

    const nodes = makeNodes();
    const particles = makeParticles();
    const facets = makeFacets(nodes);
    const xs = new Float32Array(NODE_COUNT);
    const ys = new Float32Array(NODE_COUNT);
    const rawBands = new Float32Array(BANDS);
    const bands = new Float32Array(BANDS); // smoothed
    const vxs = new Float32Array(80); // veil centerline scratch
    const vys = new Float32Array(80);
    const ixs = new Float32Array(80); // veil inner-edge scratch
    const iys = new Float32Array(80);
    let energy = 0; // smoothed loudness 0-1
    let w = 1;
    let h = 1;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tHue = (hue: number, thinking: boolean) => (thinking ? lerp(hue, THINK_HUE, 0.5) : hue);

    function resize() {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.fillStyle = `rgb(${BG_RGB})`;
      c.fillRect(0, 0, w, h);
      if (reduceMotion) render(0);
    }

    function toBands(freq: Uint8Array) {
      if (freq.length === 0) {
        rawBands.fill(0);
        return;
      }
      const step = freq.length / BANDS;
      for (let b = 0; b < BANDS; b++) {
        const start = Math.floor(b * step);
        const end = Math.max(start + 1, Math.floor((b + 1) * step));
        let sum = 0;
        let count = 0;
        for (let i = start; i < end && i < freq.length; i++) {
          sum += freq[i];
          count++;
        }
        rawBands[b] = count ? sum / count / 255 : 0;
      }
    }

    function drawSilk(cx: number, cy: number, spanX: number, spanY: number, ts: number, R: number, v: Veil, bright: number, thinking: boolean) {
      // Centerline — only the undulation sin/cos is time-varying; base angle,
      // tilt rotation, and phase bases are precomputed on the veil.
      const sp = ts * v.speed;
      const sp08 = ts * v.speed * 0.8;
      for (let p = 0; p <= SILK_PTS; p++) {
        const rxx = v.rx * (1 + v.undul * Math.sin(v.ph1[p] + sp + v.phase));
        const ryy = v.ry * (1 + v.undul * Math.cos(v.ph2[p] + sp08 + v.phase));
        const ex = v.ca[p] * rxx * spanX;
        const ey = v.sa[p] * ryy * spanY;
        vxs[p] = cx + ex * v.ct - ey * v.st;
        vys[p] = cy + ex * v.st + ey * v.ct;
      }
      // Single tangent pass: trace the outer edge into the path, stash the inner
      // edge so the closing pass is a plain lineTo (no recomputed tangent/taper).
      const halfW = R * v.wf * (0.7 + bright * 0.5);
      c.beginPath();
      for (let p = 0; p <= SILK_PTS; p++) {
        const off = halfW * SILK_ENV[p];
        const pa = p > 0 ? p - 1 : 0;
        const pb = p < SILK_PTS ? p + 1 : SILK_PTS;
        let tx = vxs[pb] - vxs[pa];
        let ty = vys[pb] - vys[pa];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        ixs[p] = vxs[p] + ty * off;
        iys[p] = vys[p] - tx * off;
        if (p === 0) c.moveTo(vxs[p] - ty * off, vys[p] + tx * off);
        else c.lineTo(vxs[p] - ty * off, vys[p] + tx * off);
      }
      for (let p = SILK_PTS; p >= 0; p--) c.lineTo(ixs[p], iys[p]);
      c.closePath();
      const h0 = tHue(v.h0, thinking);
      const h1 = tHue(v.h1, thinking);
      const grad = c.createLinearGradient(vxs[0], vys[0], vxs[SILK_PTS], vys[SILK_PTS]);
      grad.addColorStop(0, `hsla(${h0},95%,68%,0)`);
      grad.addColorStop(0.5, `hsla(${(h0 + h1) / 2},96%,70%,${0.1 * bright})`);
      grad.addColorStop(1, `hsla(${h1},95%,68%,0)`);
      c.fillStyle = grad;
      c.fill();
      // faint bright filament sheen down the centerline
      c.beginPath();
      for (let p = 0; p <= SILK_PTS; p++) {
        if (p === 0) c.moveTo(vxs[p], vys[p]);
        else c.lineTo(vxs[p], vys[p]);
      }
      c.strokeStyle = `hsla(${(h0 + h1) / 2},98%,86%,${0.09 * bright})`;
      c.lineWidth = 1.2;
      c.lineCap = "round";
      c.stroke();
    }

    function drawTrail(cx: number, cy: number, R: number, ts: number, side: 1 | -1, bright: number) {
      // broad soft smoke streaming to the edge (behind the side waveforms)
      const x0 = cx + side * R * 0.55;
      const x1 = side < 0 ? -R * 0.05 : w + R * 0.05;
      const yc = cy + side * R * 0.06;
      const hue = side < 0 ? 300 : 135;
      c.beginPath();
      const PTS = 48;
      for (let p = 0; p <= PTS; p++) {
        const u = p / PTS;
        const x = lerp(x0, x1, u);
        const env = Math.sin(u * Math.PI);
        const y = yc + Math.sin(u * 6 + ts * 1.2 + side) * R * 0.1 * env + side * R * 0.04 * u;
        if (p === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.lineCap = "round";
      c.strokeStyle = `hsla(${hue},80%,55%,${0.05 * bright})`;
      c.lineWidth = R * 0.1;
      c.stroke();
      c.strokeStyle = `hsla(${hue},90%,70%,${0.1 * bright})`;
      c.lineWidth = R * 0.03;
      c.stroke();
    }

    function drawFacets(ts: number, e: number, thinking: boolean) {
      for (const f of facets) {
        const i = f[0];
        const j = f[1];
        const k = f[2];
        const pulse = 0.5 + 0.5 * Math.sin(ts * 1.4 + i * 0.3);
        const a = (0.035 + e * 0.1) * pulse;
        c.fillStyle = `hsla(${tHue(f[3], thinking)},92%,62%,${a})`;
        c.beginPath();
        c.moveTo(xs[i], ys[i]);
        c.lineTo(xs[j], ys[j]);
        c.lineTo(xs[k], ys[k]);
        c.closePath();
        c.fill();
      }
    }

    function drawHex(cx: number, cy: number, spanX: number, spanY: number, ts: number, bright: number, thinking: boolean) {
      const wob = Math.sin(ts * 0.5) * 0.02;
      for (const cell of HEX_CELLS) {
        const px = cx + (cell.x + wob) * spanX;
        const py = cy + cell.y * spanY;
        const pulse = 0.5 + 0.5 * Math.sin(ts * 1.6 + cell.x * 8 + cell.y * 6);
        const a = (0.075 + 0.12 * pulse) * bright;
        c.beginPath();
        for (let kk = 0; kk <= 6; kk++) {
          const hx = px + HEX_VCOS[kk] * cell.s * spanX;
          const hy = py + HEX_VSIN[kk] * cell.s * spanY * 0.9;
          if (kk === 0) c.moveTo(hx, hy);
          else c.lineTo(hx, hy);
        }
        c.strokeStyle = `hsla(${tHue(165 + pulse * 30, thinking)},88%,68%,${a * 1.4})`;
        c.lineWidth = 1.2;
        c.stroke();
        c.fillStyle = `hsla(${tHue(150 + pulse * 40, thinking)},92%,74%,${a * 1.7})`;
        c.beginPath();
        c.arc(px, py, 1.2 + pulse * 0.9, 0, Math.PI * 2);
        c.fill();
      }
    }

    function drawWave(t: number, side: 1 | -1, stateAmp: number, brightness: number, R: number, cy: number) {
      const x0 = side < 0 ? 0 : w;
      const x1 = side < 0 ? w * 0.27 : w * 0.73;
      const yc = cy + (side < 0 ? -R * 0.02 : R * 0.04);
      const grad = c.createLinearGradient(x0, 0, x1, 0);
      if (side < 0) {
        grad.addColorStop(0, `rgba(${ROSE_RGB},0)`);
        grad.addColorStop(0.5, `rgba(${ROSE_RGB},${0.5 * brightness})`);
        grad.addColorStop(1, `rgba(${INDIGO_RGB},${0.6 * brightness})`);
      } else {
        grad.addColorStop(0, `rgba(${EMERALD_RGB},0)`);
        grad.addColorStop(0.5, `rgba(${EMERALD_RGB},${0.5 * brightness})`);
        grad.addColorStop(1, `rgba(${TEAL_RGB},${0.6 * brightness})`);
      }
      c.beginPath();
      const pts = 72;
      for (let p = 0; p <= pts; p++) {
        const fr = p / pts;
        const x = lerp(x0, x1, fr);
        const b = bands[Math.min(BANDS - 1, Math.floor(fr * (BANDS - 1)))];
        const env = Math.sin(fr * Math.PI); // taper both ends
        const amp =
          (b * R * 0.11 + Math.sin(t * 4 + fr * 26 + side * 2) * R * 0.012) * env * stateAmp;
        const y = yc + amp * (side < 0 ? 1 : -1);
        if (p === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = grad;
      c.lineWidth = 1.6;
      c.stroke();
    }

    function render(t: number) {
      const audio = audioRef.current ?? IDLE_AUDIO;
      const state = audio.state;
      const thinking = state === "thinking";

      // ---- reactivity ----
      // Per-state constants come from the STATE_VIS table; only `target` is
      // dynamic (live audio level, or a self-driven pulse while thinking).
      const { baseGlow, sBright, stateAmp } = STATE_VIS[state];
      let target = 0;
      if (state === "speaking") target = audio.getOutputVolume();
      else if (state === "listening") target = audio.getInputVolume() * 0.7;
      else if (state === "thinking") target = 0.32 + 0.32 * (0.5 + 0.5 * Math.sin((t / 1000) * 2.4));
      // fast attack, slow decay
      energy += (target - energy) * (target > energy ? 0.35 : 0.06);
      energy = clamp(energy, 0, 1);

      toBands(state === "speaking" ? audio.getOutputFreq() : EMPTY);
      for (let b = 0; b < BANDS; b++) {
        const r = rawBands[b];
        bands[b] += (r - bands[b]) * (r > bands[b] ? 0.5 : 0.12);
      }

      const ts = t / 1000;
      const idleBreath = Math.sin(ts * 0.6) * 0.03;
      const breathe = 1 + energy * 0.16 + idleBreath;
      const bright = clamp(sBright + energy * 0.55, 0, 1.25);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h);
      const spanX = R * 0.42 * breathe * 1.3;
      const spanY = R * 0.42 * breathe;

      // ---- trailing afterglow (NOT a hard clear) ----
      c.globalCompositeOperation = "source-over";
      c.fillStyle = `rgba(${BG_RGB},0.17)`;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = "lighter";

      // ---- core glow (magenta/indigo) + tight hot nucleus ----
      const coreR = R * 0.5 * breathe;
      const core = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      const coreA = 0.06 + energy * 0.16;
      const coreInner = thinking ? INDIGO_RGB : CORE_RGB;
      core.addColorStop(0, `rgba(${coreInner},${coreA})`);
      core.addColorStop(0.4, `rgba(${INDIGO_RGB},${coreA * 0.5})`);
      core.addColorStop(1, `rgba(${BG_RGB},0)`);
      c.fillStyle = core;
      c.fillRect(0, 0, w, h);
      const hotR = R * (0.055 + energy * 0.045) * breathe;
      const hot = c.createRadialGradient(cx, cy, 0, cx, cy, hotR);
      const hotA = 0.07 + energy * 0.18;
      hot.addColorStop(0, `rgba(255,238,252,${hotA})`);
      hot.addColorStop(0.5, `rgba(${coreInner},${hotA * 0.55})`);
      hot.addColorStop(1, `rgba(${coreInner},0)`);
      c.fillStyle = hot;
      c.fillRect(cx - hotR * 1.3, cy - hotR * 1.3, hotR * 2.6, hotR * 2.6);

      // ---- trailing smoke (behind the veils) ----
      drawTrail(cx, cy, R, ts, -1, bright);
      drawTrail(cx, cy, R, ts, 1, bright);

      // ---- wrapping silk veils ----
      for (const v of VEILS) drawSilk(cx, cy, spanX, spanY, ts, R, v, bright, thinking);

      // ---- node screen positions (base coords precomputed; only drift uses trig) ----
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];
        const dx = Math.sin(ts * n.dSpeed + n.dPhase) * n.dAmp;
        const dy = Math.cos(ts * n.dSpeed2 + n.dPhase2) * n.dAmp;
        xs[i] = cx + (n.bx + dx) * spanX;
        ys[i] = cy + (n.by + dy) * spanY;
      }

      // ---- crystalline facets + honeycomb patch (behind edges/nodes) ----
      drawFacets(ts, energy, thinking);
      drawHex(cx, cy, spanX, spanY, ts, bright, thinking);

      // ---- edges (plexus web) ----
      const maxDist = R * EDGE_DIST_FRAC;
      const maxDist2 = maxDist * maxDist;
      const lineBoost = 0.45 + energy * 0.8;
      c.lineWidth = 1;
      for (let i = 0; i < NODE_COUNT; i++) {
        const xi = xs[i];
        const yi = ys[i];
        const hueI = tHue(nodes[i].hue, thinking);
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dx = xi - xs[j];
          const dy = yi - ys[j];
          const d2 = dx * dx + dy * dy;
          if (d2 >= maxDist2) continue;
          const d = Math.sqrt(d2);
          const a = (1 - d / maxDist) * 0.18 * lineBoost;
          if (a < 0.012) continue;
          c.strokeStyle = `hsla(${hueI}, 85%, 64%, ${a})`;
          c.beginPath();
          c.moveTo(xi, yi);
          c.lineTo(xs[j], ys[j]);
          c.stroke();
        }
      }

      // ---- nodes (radial-gradient glows) ----
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];
        const bandE = state === "speaking" ? bands[n.band] : 0;
        const nodeEnergy = clamp(baseGlow + energy * 0.5 + bandE, 0, 1.5);
        const tw = 0.72 + 0.28 * Math.sin(ts * 2 + n.twPhase);
        const glowR = n.size * (1 + nodeEnergy * 2.2);
        const alpha = clamp(0.12 + nodeEnergy * 0.55, 0, 0.9) * tw;
        const hue = tHue(n.hue, thinking);
        const sat = state === "listening" ? 70 : thinking ? 80 : 92;
        const light = 62 + nodeEnergy * 14;
        const g = c.createRadialGradient(xs[i], ys[i], 0, xs[i], ys[i], glowR);
        g.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`);
        g.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
        c.fillStyle = g;
        c.beginPath();
        c.arc(xs[i], ys[i], glowR, 0, Math.PI * 2);
        c.fill();
      }

      // ---- particle dust ----
      for (const p of particles) {
        const ang = p.a + Math.sin(ts * p.sp + p.ph) * 0.05;
        const rr = p.r * (1 + Math.sin(ts * 0.3 + p.ph) * 0.02);
        const px = cx + Math.cos(ang) * rr * spanX;
        const py = cy + Math.sin(ang) * rr * spanY * 0.9;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(ts * 1.5 + p.tw));
        const a = clamp(0.12 + energy * 0.3, 0, 0.5) * tw;
        c.fillStyle = `hsla(${tHue(p.hue, thinking)},90%,70%,${a})`;
        c.beginPath();
        c.arc(px, py, p.sz * (0.8 + tw * 0.6), 0, Math.PI * 2);
        c.fill();
      }

      // ---- side waveform ribbons (stateAmp from the STATE_VIS table) ----
      const waveBright = clamp(0.35 + energy * 0.6, 0, 1);
      drawWave(ts, -1, stateAmp, waveBright, R, cy);
      drawWave(ts, 1, stateAmp, waveBright, R, cy);

      c.globalCompositeOperation = "source-over";
    }

    let raf = 0;
    let running = false;
    const loop = (t: number) => {
      render(t);
      raf = requestAnimationFrame(loop);
    };
    function start() {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [audioRef]);

  return <canvas ref={canvasRef} aria-hidden className={cn("block h-full w-full", className)} />;
}
