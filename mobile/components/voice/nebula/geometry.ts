/**
 * Nebula geometry + constants — a pure, DOM-free 1:1 port of the web
 * `ui/src/components/NebulaCanvas.tsx` init math. The Skia draw loop
 * (`NebulaCanvas.tsx`) consumes everything here; keep this file free of any
 * Skia/React imports so the visual math stays identical to web and easy to diff.
 *
 * `Math.random()` runs only at init (module load / component mount), never per
 * frame — exactly like web. The layout reseeds each launch (acceptable; seed the
 * RNG here if a stable layout is ever wanted).
 */

/** The live state that drives the nebula (mirrors the web `NebulaState`). */
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
 *  3 closures on any frame where the audio ref is momentarily null. */
export const IDLE_AUDIO = idleNebulaAudio();

// Brand anchor colors as [r,g,b] tuples (0-255) — mirror the dark-only theme
// tokens (--background/--teal/--emerald/--indigo/--rose). The procedural
// node/edge/veil hues below stay generative (hsl), not tokens.
export type RGB = readonly [number, number, number];
export const BG_RGB: RGB = [8, 8, 10]; // --background  #08080a
export const TEAL_RGB: RGB = [94, 234, 212]; // --teal
export const EMERALD_RGB: RGB = [52, 211, 153]; // --emerald
export const INDIGO_RGB: RGB = [129, 140, 248]; // --indigo
export const ROSE_RGB: RGB = [251, 113, 133]; // --rose  #fb7185
export const CORE_RGB: RGB = [232, 80, 180]; // hot magenta core (procedural, no token)

// ---- tunables ----------------------------------------------------------------
export const NODE_COUNT = 150;
export const BANDS = 48;
export const EDGE_DIST_FRAC = 0.14; // proximity radius for plexus edges, as a frac of min(w,h)
export const PARTICLE_COUNT = 110;
export const THINK_HUE = 236; // indigo target the whole cloud shifts toward while "thinking"

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** While "thinking", pull every hue halfway toward indigo. */
export const tHue = (hue: number, thinking: boolean) =>
  thinking ? lerp(hue, THINK_HUE, 0.5) : hue;

/** Per-state visual constants, in one place. The draw loop reads this; only the
 *  dynamic `target` (audio level / thinking pulse) is computed in code. */
export const STATE_VIS: Record<
  NebulaState,
  { baseGlow: number; sBright: number; stateAmp: number }
> = {
  idle: { baseGlow: 0.18, sBright: 0.38, stateAmp: 0.16 },
  connecting: { baseGlow: 0.26, sBright: 0.45, stateAmp: 0.25 },
  listening: { baseGlow: 0.3, sBright: 0.5, stateAmp: 0.45 },
  thinking: { baseGlow: 0.34, sBright: 0.58, stateAmp: 0.5 },
  speaking: { baseGlow: 0.42, sBright: 0.7, stateAmp: 1 },
};

export interface NebulaNode {
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

/** Deterministic-ish nodes laid out in an organic squashed spheroid. */
export function makeNodes(): NebulaNode[] {
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

export interface Particle {
  a: number;
  r: number;
  hue: number;
  sp: number;
  ph: number;
  sz: number;
  tw: number;
}

/** Sparse drifting dust in a halo wider than the plexus core. */
export function makeParticles(): Particle[] {
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

/** [i, j, k, hue] triangles among mutually-close core nodes → crystalline facets. */
export type Facet = [number, number, number, number];

export function makeFacets(nodes: NebulaNode[]): Facet[] {
  const facets: Facet[] = [];
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

export interface VeilSpec {
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
export const VEIL_SPECS: VeilSpec[] = [
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

// Veil geometry has many per-point terms that are constant across frames (base
// angle, undulation phase bases, tilt rotation, width taper). Precompute them
// ONCE so the per-frame loop only does the genuinely time-varying trig.
export const SILK_PTS = 64;
export const SILK_ENV = new Float32Array(SILK_PTS + 1); // sin taper, fixed per index
for (let p = 0; p <= SILK_PTS; p++) SILK_ENV[p] = Math.sin((p / SILK_PTS) * Math.PI);

export interface Veil extends VeilSpec {
  ct: number; // cos(tilt)
  st: number; // sin(tilt)
  ca: Float32Array; // cos(angle) per point
  sa: Float32Array; // sin(angle) per point
  ph1: Float32Array; // undulation phase base for rxx
  ph2: Float32Array; // undulation phase base for ryy
}

export const VEILS: Veil[] = VEIL_SPECS.map((s) => {
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

export interface HexCell {
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
export const HEX_CELLS = makeHexCells();

// Hexagon vertex directions are 7 fixed angles — precompute once, not per cell per frame.
export const HEX_VCOS = new Float32Array(7);
export const HEX_VSIN = new Float32Array(7);
for (let kk = 0; kk <= 6; kk++) {
  const a = (Math.PI / 3) * kk + 0.5;
  HEX_VCOS[kk] = Math.cos(a);
  HEX_VSIN[kk] = Math.sin(a);
}
