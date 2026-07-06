/**
 * NebulaCanvas — the audio-reactive "digital nebula" for the Mergatroid voice
 * screen, a faithful Skia port of the web `ui/src/components/NebulaCanvas.tsx`
 * (Canvas 2D). A glowing neon plexus brain wrapped in flowing silk veils, with a
 * hot core, crystalline facets, a honeycomb patch, drifting dust, and side
 * waveform ribbons — all additively blended (`BlendMode.Plus`, == Canvas
 * "lighter") over a transparent background.
 *
 * Each frame is recorded into a Skia **`Picture`** (a display list) and drawn
 * directly by the on-screen `<Canvas>` (`opaque={false}`), so the additive glow
 * composites over the app's aurora and the background is see-through wherever
 * there's no glow. The whole visual is derived from one `state` enum + three audio
 * scalars (output/input volume, output FFT) read from `audioRef` once per frame —
 * exactly the web contract (see geometry.ts / NebulaAudio).
 *
 * NOTE: the web version uses a persistent framebuffer for motion-trail afterglow.
 * That was originally ported as an offscreen `SkSurface` snapshotted every frame,
 * but each snapshot is a ~5 MB SkImage that react-native-skia does not free fast
 * enough → the app was memory-killed (jetsam per-process-limit, ~3.4 GB) within
 * ~10s. The Picture approach allocates no per-frame bitmap and fixes the crash, at
 * the cost of the cross-frame afterglow trails (the per-frame look is unchanged).
 *
 * Performance architecture (all output-identical):
 * - **Brightness in one pass:** the accumulation buffer used to build static
 *   elements up to ~6× brightness; instead of replaying the picture 6× (6×
 *   full-screen overdraw) the scene records through a `saveLayer` whose restore
 *   scales the premultiplied pixels ×`GLOW_GAIN` (runtime-shader image filter) —
 *   the exact single-pass equivalent of N additive replays. The layer is F16 so
 *   dim pre-scale values accumulate without 8-bit clamping/banding.
 * - **No per-frame shader/color churn:** node glows draw as ONE `drawAtlas` call
 *   over a pre-rasterized white radial sprite (per-node RSXform + tint color)
 *   instead of 150 `MakeRadialGradient` allocations; the core glows use cached
 *   unit-space gradients driven by canvas transforms + `setAlphaf`; all transient
 *   SkColors come from a rotating scratch pool (native calls copy synchronously).
 * - **Plexus edges via a spatial grid:** same distance threshold/alpha math, but
 *   only same/neighbor-cell pairs are tested (was O(n²) ≈ 11k checks/frame).
 *
 * Pauses on app-background (and unmounts stop the loop when you navigate away);
 * renders a single static frame under Reduce Motion. NODE_COUNT / PARTICLE_COUNT
 * remain the knobs if a device ever needs them.
 */
import {
  BlendMode,
  Canvas,
  drawAsImageFromPicture,
  PaintStyle,
  Picture as SkiaPicture,
  SaveLayerFlag,
  Skia,
  StrokeCap,
  TileMode,
  type SkCanvas,
  type SkColor,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkRect,
  type SkRSXform,
} from "@shopify/react-native-skia";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";

import {
  BANDS,
  BG_RGB,
  clamp,
  CORE_RGB,
  EDGE_DIST_FRAC,
  EMERALD_RGB,
  EMPTY,
  HEX_CELLS,
  HEX_VCOS,
  HEX_VSIN,
  IDLE_AUDIO,
  INDIGO_RGB,
  lerp,
  makeFacets,
  makeNodes,
  makeParticles,
  NODE_COUNT,
  ROSE_RGB,
  SILK_ENV,
  SILK_PTS,
  STATE_VIS,
  TEAL_RGB,
  tHue,
  VEILS,
  type NebulaAudio,
  type RGB,
} from "./geometry";

// ---- SkColor helpers (SkColor is an RGBA Float32Array, channels 0-1) ---------
// Every color here is transient — consumed synchronously by setColor / the
// gradient factories, which copy the values into native objects — so the helpers
// write into a small rotating pool instead of allocating a fresh Float32Array per
// call (hundreds/frame at 60fps otherwise).
const COLOR_POOL = Array.from({ length: 16 }, () => new Float32Array(4));
let colorPoolIdx = 0;
const f32 = (r: number, g: number, b: number, a: number): SkColor => {
  const c = COLOR_POOL[(colorPoolIdx = (colorPoolIdx + 1) & 15)];
  c[0] = r;
  c[1] = g;
  c[2] = b;
  c[3] = a;
  return c;
};
const rgba = (rgb: RGB, a: number): SkColor => f32(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, a);
const rgb3 = (r: number, g: number, b: number, a: number): SkColor => f32(r / 255, g / 255, b / 255, a);

/** HSL (h deg, s/l as 0-100 percentages like the web `hsla()` literals) written
 *  into `dst` — the allocation-free core used by both `hsla()` (pooled) and the
 *  atlas tint buffers (per-node persistent arrays). */
function hslaInto(dst: Float32Array, h: number, sPct: number, lPct: number, a: number): SkColor {
  const s = sPct / 100;
  const l = lPct / 100;
  if (s === 0) {
    dst[0] = l;
    dst[1] = l;
    dst[2] = l;
    dst[3] = a;
    return dst;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  const ch = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  dst[0] = ch(hk + 1 / 3);
  dst[1] = ch(hk);
  dst[2] = ch(hk - 1 / 3);
  dst[3] = a;
  return dst;
}
const hsla = (h: number, sPct: number, lPct: number, a: number): SkColor =>
  hslaInto(COLOR_POOL[(colorPoolIdx = (colorPoolIdx + 1) & 15)], h, sPct, lPct, a);

// Reused gradient color-array + stop-position scratch (the factories copy
// synchronously; only ONE gradient is ever built per statement).
const GRAD3: SkColor[] = [COLOR_POOL[0], COLOR_POOL[0], COLOR_POOL[0]];
const grad3 = (a: SkColor, b: SkColor, c: SkColor): SkColor[] => {
  GRAD3[0] = a;
  GRAD3[1] = b;
  GRAD3[2] = c;
  return GRAD3;
};
const STOPS_MID = [0, 0.5, 1];
const STOPS_04 = [0, 0.4, 1];
const STOPS_2 = [0, 1];

/** Live touch point (CSS px, canvas space) + whether a finger is down. The host
 *  screen owns the touch handlers (on the shared parent, so overlay children
 *  don't intercept) and feeds this ref; the draw loop pokes the nebula here. */
export interface NebulaTouch {
  x: number;
  y: number;
  active: boolean;
}
const NO_TOUCH: NebulaTouch = { x: 0, y: 0, active: false };

interface NebulaCanvasProps {
  audioRef: RefObject<NebulaAudio | null>;
  touchRef?: RefObject<NebulaTouch>;
  style?: object;
}

// The old offscreen accumulation buffer kept ~83% of the prior frame, building a
// static element up to ~1/(1-0.83) ≈ 6× its single-frame brightness. The scene
// records through an F16 saveLayer whose restore paint scales RGB ×GLOW_GAIN —
// the single-pass equivalent of replaying the additive picture GLOW_GAIN times,
// without the N× overdraw. Tune for brightness.
const GLOW_GAIN = 6;

// Node glows draw via one drawAtlas over this pre-rasterized white radial-falloff
// sprite (tinted per node) instead of 150 per-frame MakeRadialGradient shaders.
// 128px keeps the falloff smooth at the largest glow radii.
const SPRITE_SIZE = 128;

export function NebulaCanvas({ audioRef, touchRef, style }: NebulaCanvasProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // NOTE: the picture is React state, not a Reanimated SharedValue. Assigning a
  // JS-runtime Skia host object into a SharedValue crashes: RN Skia's UI-thread
  // listener worklet aborts when it dereferences the cross-runtime SkPicture
  // (SIGABRT in WorkletRuntime::runSync, reproduced on-device). Zero-React-work
  // frames require recording the picture ON the UI runtime (a follow-up).
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!size) return;
    const { w, h } = size;
    // No offscreen accumulation surface. Reading one back every frame
    // (makeImageSnapshot) allocates a ~5 MB SkImage that react-native-skia does not
    // free fast enough → the app is memory-killed (jetsam per-process-limit) in ~10s.
    // Instead each frame is recorded into a lightweight Picture (a display list,
    // KB-scale) and drawn directly by the on-screen <Canvas> (already device-res +
    // transparent). `canvas` is reassigned per frame in render(); the draw helpers
    // read it via closure. Trade-off: no cross-frame afterglow trails (they needed
    // the persistent framebuffer); the per-frame additive look is unchanged and the
    // transparent background is now automatic.
    let canvas: SkCanvas;

    // ---- retained scene + scratch (init math == web makeNodes/... ) ----------
    const nodes = makeNodes();
    const particles = makeParticles();
    const facets = makeFacets(nodes);
    const xs = new Float32Array(NODE_COUNT);
    const ys = new Float32Array(NODE_COUNT);
    const rawBands = new Float32Array(BANDS);
    const bands = new Float32Array(BANDS); // smoothed
    const vxs = new Float32Array(SILK_PTS + 2); // veil centerline scratch
    const vys = new Float32Array(SILK_PTS + 2);
    const ixs = new Float32Array(SILK_PTS + 2); // veil inner-edge scratch
    const iys = new Float32Array(SILK_PTS + 2);
    let energy = 0; // smoothed loudness 0-1
    let touchGlow = 0; // smoothed 0-1 finger-poke intensity (fast attack, slow decay)

    // Dispose the prior Picture with a 2-frame lag (never free one the <Canvas> may
    // still be drawing). Pictures are cheap; this is belt-and-suspenders.
    let shownPic: SkPicture | null = null;
    let stalePic: SkPicture | null = null;

    const fullRect = Skia.XYWHRect(0, 0, w, h);

    // Frame geometry that never changes for a given size (the old per-frame
    // consts, hoisted).
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h);
    const maxDist = R * EDGE_DIST_FRAC;
    const maxDist2 = maxDist * maxDist;

    // ---- reused paints. All additive Plus blend (== Canvas "lighter"). ----
    const fill: SkPaint = Skia.Paint();
    fill.setStyle(PaintStyle.Fill);
    fill.setAntiAlias(true);
    fill.setBlendMode(BlendMode.Plus);
    const stroke: SkPaint = Skia.Paint();
    stroke.setStyle(PaintStyle.Stroke);
    stroke.setAntiAlias(true);
    stroke.setBlendMode(BlendMode.Plus);
    const path = Skia.Path.Make();

    // ---- brightness gain layer (see GLOW_GAIN) --------------------------------
    // N additive replays scale the PREMULTIPLIED contribution (alpha included), so
    // a color-matrix filter (unpremul) can't reproduce them. A runtime-shader
    // image filter samples the layer's premul pixels directly: min(c*N, 1) per
    // channel is exactly what N Plus-blended replays accumulate to.
    const gainEffect = Skia.RuntimeEffect.Make(`
      uniform shader image;
      half4 main(float2 xy) {
        return min(image.eval(xy) * ${GLOW_GAIN}.0, half4(1.0));
      }
    `);
    const scalePaint = Skia.Paint();
    if (gainEffect) {
      scalePaint.setImageFilter(
        Skia.ImageFilter.MakeRuntimeShader(Skia.RuntimeShaderBuilder(gainEffect), null, null),
      );
    } else {
      // SkSL compile failure (shouldn't happen) — approximate with an alpha-row
      // color matrix: exact for draws with alpha ≤ 1/GLOW_GAIN (most of the scene),
      // slightly compresses the brightest cores.
      scalePaint.setColorFilter(
        Skia.ColorFilter.MakeMatrix([
          1, 0, 0, 0, 0,
          0, 1, 0, 0, 0,
          0, 0, 1, 0, 0,
          0, 0, 0, GLOW_GAIN, 0,
        ]),
      );
    }

    // ---- cached core-glow paints ---------------------------------------------
    // The gradient SHAPE is constant: unit-space (center 0,0, radius 1) stops with
    // the per-frame coreA/hotA factored out. Per frame only the canvas transform
    // (center/radius) and paint alpha (setAlphaf multiplies the shader) change —
    // no shader creation. Two variants each: the inner color flips magenta↔indigo
    // while "thinking".
    const mkUnitRadialPaint = (colors: SkColor[], stops: number[]): SkPaint => {
      const p = Skia.Paint();
      p.setStyle(PaintStyle.Fill);
      p.setAntiAlias(true);
      p.setBlendMode(BlendMode.Plus);
      p.setShader(
        Skia.Shader.MakeRadialGradient(Skia.Point(0, 0), 1, colors, stops, TileMode.Clamp),
      );
      return p;
    };
    const mkCorePaint = (inner: RGB) =>
      mkUnitRadialPaint(grad3(rgba(inner, 1), rgba(INDIGO_RGB, 0.5), rgba(BG_RGB, 0)), STOPS_04);
    const mkHotPaint = (inner: RGB) =>
      mkUnitRadialPaint(grad3(rgb3(255, 238, 252, 1), rgba(inner, 0.55), rgba(inner, 0)), STOPS_MID);
    const corePaintNormal = mkCorePaint(CORE_RGB);
    const corePaintThink = mkCorePaint(INDIGO_RGB);
    const hotPaintNormal = mkHotPaint(CORE_RGB);
    const hotPaintThink = mkHotPaint(INDIGO_RGB);
    /** drawRect(fullRect, radial shader) == a disc of the gradient's radius (the
     *  outer stop is alpha-0), so the cached unit gradient draws as a unit circle
     *  under a translate+scale — identical coverage, no per-frame shader. */
    const drawUnitGlow = (paint: SkPaint, gx: number, gy: number, radius: number, alpha: number) => {
      paint.setAlphaf(alpha);
      canvas.save();
      canvas.translate(gx, gy);
      canvas.scale(radius, radius);
      canvas.drawCircle(0, 0, 1, paint);
      canvas.restore();
    };

    // ---- node-glow atlas -------------------------------------------------------
    // One white radial sprite rasterized ONCE (not per frame — per-frame snapshots
    // are what caused the OOM), then one drawAtlas call per frame: per-node
    // RSXform (scale+position) and tint color, Modulate(color × sprite) for the
    // falloff, the paint's Plus blend for the additive composite. Identical math
    // to the old per-node 2-stop radial gradient.
    const spriteRec = Skia.PictureRecorder();
    const spriteCanvas = spriteRec.beginRecording(Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE));
    const spritePaint = Skia.Paint();
    spritePaint.setAntiAlias(true);
    spritePaint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(SPRITE_SIZE / 2, SPRITE_SIZE / 2),
        SPRITE_SIZE / 2,
        [f32(1, 1, 1, 1), f32(1, 1, 1, 0)],
        STOPS_2,
        TileMode.Clamp,
      ),
    );
    spriteCanvas.drawCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2, spritePaint);
    const glowSprite: SkImage | null = drawAsImageFromPicture(
      spriteRec.finishRecordingAsPicture(),
      { width: SPRITE_SIZE, height: SPRITE_SIZE },
    );
    const spriteRect = Skia.XYWHRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const atlasSrcs: SkRect[] = new Array(NODE_COUNT).fill(spriteRect);
    const atlasXforms: SkRSXform[] = Array.from({ length: NODE_COUNT }, () =>
      Skia.RSXform(1, 0, 0, 0),
    );
    const atlasColors: SkColor[] = Array.from({ length: NODE_COUNT }, () => new Float32Array(4));
    const atlasPaint = Skia.Paint();
    atlasPaint.setAntiAlias(true);
    atlasPaint.setBlendMode(BlendMode.Plus);

    // ---- plexus spatial grid ---------------------------------------------------
    // Cell size == maxDist, so any qualifying pair is in the same or an adjacent
    // cell; each pair is visited once (own cell + 4 forward neighbors). The margin
    // covers node drift past the screen edges; distance/alpha math is unchanged →
    // pixel-identical edges, ~5-10× fewer pair checks than the O(n²) sweep.
    const gridMargin = R;
    const gridCols = Math.max(1, Math.ceil((w + 2 * gridMargin) / maxDist));
    const gridRows = Math.max(1, Math.ceil((h + 2 * gridMargin) / maxDist));
    const nCells = gridCols * gridRows;
    const cellCount = new Int32Array(nCells);
    const cellStart = new Int32Array(nCells + 1);
    const cellOf = new Int32Array(NODE_COUNT);
    const cellNodes = new Int32Array(NODE_COUNT);
    const FWD_X = [1, -1, 0, 1]; // E, SW, S, SE — forward neighbors only
    const FWD_Y = [0, 1, 1, 1];

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

    function drawSilk(
      spanX: number,
      spanY: number,
      ts: number,
      v: (typeof VEILS)[number],
      bright: number,
      thinking: boolean,
    ) {
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
      const halfW = R * v.wf * (0.7 + bright * 0.5);
      path.rewind();
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
        if (p === 0) path.moveTo(vxs[p] - ty * off, vys[p] + tx * off);
        else path.lineTo(vxs[p] - ty * off, vys[p] + tx * off);
      }
      for (let p = SILK_PTS; p >= 0; p--) path.lineTo(ixs[p], iys[p]);
      path.close();
      const h0 = tHue(v.h0, thinking);
      const h1 = tHue(v.h1, thinking);
      const grad = Skia.Shader.MakeLinearGradient(
        Skia.Point(vxs[0], vys[0]),
        Skia.Point(vxs[SILK_PTS], vys[SILK_PTS]),
        grad3(hsla(h0, 95, 68, 0), hsla((h0 + h1) / 2, 96, 70, 0.1 * bright), hsla(h1, 95, 68, 0)),
        STOPS_MID,
        TileMode.Clamp,
      );
      fill.setShader(grad);
      canvas.drawPath(path, fill);
      // faint bright filament sheen down the centerline
      path.rewind();
      for (let p = 0; p <= SILK_PTS; p++) {
        if (p === 0) path.moveTo(vxs[p], vys[p]);
        else path.lineTo(vxs[p], vys[p]);
      }
      stroke.setShader(null);
      stroke.setStrokeCap(StrokeCap.Round);
      stroke.setStrokeWidth(1.2);
      stroke.setColor(hsla((h0 + h1) / 2, 98, 86, 0.09 * bright));
      canvas.drawPath(path, stroke);
    }

    function drawTrail(ts: number, side: 1 | -1, bright: number) {
      const x0 = cx + side * R * 0.55;
      const x1 = side < 0 ? -R * 0.05 : w + R * 0.05;
      const yc = cy + side * R * 0.06;
      const hue = side < 0 ? 300 : 135;
      path.rewind();
      const PTS = 48;
      for (let p = 0; p <= PTS; p++) {
        const u = p / PTS;
        const x = lerp(x0, x1, u);
        const env = Math.sin(u * Math.PI);
        const y = yc + Math.sin(u * 6 + ts * 1.2 + side) * R * 0.1 * env + side * R * 0.04 * u;
        if (p === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      stroke.setShader(null);
      stroke.setStrokeCap(StrokeCap.Round);
      stroke.setColor(hsla(hue, 80, 55, 0.05 * bright));
      stroke.setStrokeWidth(R * 0.1);
      canvas.drawPath(path, stroke);
      stroke.setColor(hsla(hue, 90, 70, 0.1 * bright));
      stroke.setStrokeWidth(R * 0.03);
      canvas.drawPath(path, stroke);
    }

    function drawFacets(ts: number, e: number, thinking: boolean) {
      for (const fct of facets) {
        const i = fct[0];
        const j = fct[1];
        const k = fct[2];
        const pulse = 0.5 + 0.5 * Math.sin(ts * 1.4 + i * 0.3);
        const a = (0.035 + e * 0.1) * pulse;
        fill.setShader(null);
        fill.setColor(hsla(tHue(fct[3], thinking), 92, 62, a));
        path.rewind();
        path.moveTo(xs[i], ys[i]);
        path.lineTo(xs[j], ys[j]);
        path.lineTo(xs[k], ys[k]);
        path.close();
        canvas.drawPath(path, fill);
      }
    }

    function drawHex(spanX: number, spanY: number, ts: number, bright: number, thinking: boolean) {
      const wob = Math.sin(ts * 0.5) * 0.02;
      for (const cell of HEX_CELLS) {
        const px = cx + (cell.x + wob) * spanX;
        const py = cy + cell.y * spanY;
        const pulse = 0.5 + 0.5 * Math.sin(ts * 1.6 + cell.x * 8 + cell.y * 6);
        const a = (0.075 + 0.12 * pulse) * bright;
        path.rewind();
        for (let kk = 0; kk <= 6; kk++) {
          const hx = px + HEX_VCOS[kk] * cell.s * spanX;
          const hy = py + HEX_VSIN[kk] * cell.s * spanY * 0.9;
          if (kk === 0) path.moveTo(hx, hy);
          else path.lineTo(hx, hy);
        }
        stroke.setShader(null);
        stroke.setStrokeCap(StrokeCap.Round);
        stroke.setStrokeWidth(1.2);
        stroke.setColor(hsla(tHue(165 + pulse * 30, thinking), 88, 68, a * 1.4));
        canvas.drawPath(path, stroke);
        fill.setShader(null);
        fill.setColor(hsla(tHue(150 + pulse * 40, thinking), 92, 74, a * 1.7));
        canvas.drawCircle(px, py, 1.2 + pulse * 0.9, fill);
      }
    }

    function drawWave(t: number, side: 1 | -1, stateAmp: number, brightness: number) {
      const x0 = side < 0 ? 0 : w;
      const x1 = side < 0 ? w * 0.27 : w * 0.73;
      const yc = cy + (side < 0 ? -R * 0.02 : R * 0.04);
      const colors =
        side < 0
          ? grad3(
              rgba(ROSE_RGB, 0),
              rgba(ROSE_RGB, 0.5 * brightness),
              rgba(INDIGO_RGB, 0.6 * brightness),
            )
          : grad3(
              rgba(EMERALD_RGB, 0),
              rgba(EMERALD_RGB, 0.5 * brightness),
              rgba(TEAL_RGB, 0.6 * brightness),
            );
      const grad = Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, 0),
        Skia.Point(x1, 0),
        colors,
        STOPS_MID,
        TileMode.Clamp,
      );
      path.rewind();
      const pts = 72;
      for (let p = 0; p <= pts; p++) {
        const fr = p / pts;
        const x = lerp(x0, x1, fr);
        const b = bands[Math.min(BANDS - 1, Math.floor(fr * (BANDS - 1)))];
        const env = Math.sin(fr * Math.PI);
        const amp = (b * R * 0.11 + Math.sin(t * 4 + fr * 26 + side * 2) * R * 0.012) * env * stateAmp;
        const y = yc + amp * (side < 0 ? 1 : -1);
        if (p === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      stroke.setShader(grad);
      stroke.setStrokeCap(StrokeCap.Round);
      stroke.setStrokeWidth(1.6);
      canvas.drawPath(path, stroke);
      stroke.setShader(null);
    }

    function render(t: number) {
      const recorder = Skia.PictureRecorder();
      canvas = recorder.beginRecording(fullRect);
      // Record the whole scene into an F16 layer whose restore scales RGB
      // ×GLOW_GAIN — one pass instead of GLOW_GAIN additive replays.
      canvas.saveLayer(scalePaint, fullRect, null, SaveLayerFlag.SaveLayerF16ColorType);

      const audio = audioRef.current ?? IDLE_AUDIO;
      const state = audio.state;
      const thinking = state === "thinking";

      const { baseGlow, sBright, stateAmp } = STATE_VIS[state];
      let target = 0;
      if (state === "speaking") target = audio.getOutputVolume();
      else if (state === "listening") target = audio.getInputVolume() * 0.7;
      else if (state === "thinking") target = 0.32 + 0.32 * (0.5 + 0.5 * Math.sin((t / 1000) * 2.4));
      energy += (target - energy) * (target > energy ? 0.35 : 0.06); // fast attack, slow decay
      energy = clamp(energy, 0, 1);

      toBands(state === "speaking" ? audio.getOutputFreq() : EMPTY);
      for (let b = 0; b < BANDS; b++) {
        const r = rawBands[b];
        bands[b] += (r - bands[b]) * (r > bands[b] ? 0.5 : 0.12);
      }

      // ---- touch reactivity ----
      // A finger poke eases in a "touch glow" that flares the whole cloud and
      // seeds a bright local burst; releasing lets it decay. `eEff` == energy
      // when untouched, so audio behavior is unchanged with no finger down.
      const touch = touchRef?.current ?? NO_TOUCH;
      touchGlow += ((touch.active ? 1 : 0) - touchGlow) * (touch.active ? 0.4 : 0.05);
      const eEff = clamp(energy + touchGlow * 0.5, 0, 1.2);

      const ts = t / 1000;
      const idleBreath = Math.sin(ts * 0.6) * 0.03;
      const breathe = 1 + eEff * 0.16 + idleBreath;
      const bright = clamp(sBright + eEff * 0.55, 0, 1.25);

      const spanX = R * 0.42 * breathe * 1.3;
      const spanY = R * 0.42 * breathe;

      // (No afterglow wash: each Picture starts blank/transparent; the additive
      //  layers below composite over it, then over the app aurora behind the Canvas.)

      // ---- core glow (magenta/indigo) + tight hot nucleus ----
      const coreR = R * 0.5 * breathe;
      const coreA = 0.06 + energy * 0.16;
      drawUnitGlow(thinking ? corePaintThink : corePaintNormal, cx, cy, coreR, coreA);
      const hotR = R * (0.055 + energy * 0.045) * breathe;
      const hotA = 0.07 + energy * 0.18;
      drawUnitGlow(thinking ? hotPaintThink : hotPaintNormal, cx, cy, hotR, hotA);

      // ---- trailing smoke (behind the veils) ----
      drawTrail(ts, -1, bright);
      drawTrail(ts, 1, bright);

      // ---- wrapping silk veils ----
      for (const v of VEILS) drawSilk(spanX, spanY, ts, v, bright, thinking);

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
      drawHex(spanX, spanY, ts, bright, thinking);

      // ---- edges (plexus web), via the spatial grid ----
      const lineBoost = 0.45 + energy * 0.8;
      stroke.setShader(null);
      stroke.setStrokeCap(StrokeCap.Butt);
      stroke.setStrokeWidth(1);
      // Same alpha/hue math as the old O(n²) sweep; `a` is always the lower node
      // index so the hue matches the old `nodes[i].hue` (Plus blending is
      // commutative, so pair order doesn't affect the output).
      const edge = (p: number, q: number) => {
        const i = p < q ? p : q;
        const j = p < q ? q : p;
        const dx = xs[i] - xs[j];
        const dy = ys[i] - ys[j];
        const d2 = dx * dx + dy * dy;
        if (d2 >= maxDist2) return;
        const d = Math.sqrt(d2);
        const a = (1 - d / maxDist) * 0.18 * lineBoost;
        if (a < 0.012) return;
        stroke.setColor(hsla(tHue(nodes[i].hue, thinking), 85, 64, a));
        canvas.drawLine(xs[i], ys[i], xs[j], ys[j], stroke);
      };
      // bucket nodes (counting sort, no allocation) …
      cellCount.fill(0);
      for (let i = 0; i < NODE_COUNT; i++) {
        let gx = Math.floor((xs[i] + gridMargin) / maxDist);
        let gy = Math.floor((ys[i] + gridMargin) / maxDist);
        gx = gx < 0 ? 0 : gx >= gridCols ? gridCols - 1 : gx;
        gy = gy < 0 ? 0 : gy >= gridRows ? gridRows - 1 : gy;
        const ci = gy * gridCols + gx;
        cellOf[i] = ci;
        cellCount[ci]++;
      }
      cellStart[0] = 0;
      for (let c = 0; c < nCells; c++) cellStart[c + 1] = cellStart[c] + cellCount[c];
      cellCount.fill(0);
      for (let i = 0; i < NODE_COUNT; i++) {
        const ci = cellOf[i];
        cellNodes[cellStart[ci] + cellCount[ci]++] = i;
      }
      // … then test only same-cell + forward-neighbor-cell pairs.
      for (let gy = 0; gy < gridRows; gy++) {
        for (let gx = 0; gx < gridCols; gx++) {
          const ci = gy * gridCols + gx;
          const s0 = cellStart[ci];
          const e0 = cellStart[ci + 1];
          if (s0 === e0) continue;
          for (let a = s0; a < e0; a++) {
            for (let b = a + 1; b < e0; b++) edge(cellNodes[a], cellNodes[b]);
          }
          for (let f = 0; f < 4; f++) {
            const nx = gx + FWD_X[f];
            const ny = gy + FWD_Y[f];
            if (nx < 0 || nx >= gridCols || ny >= gridRows) continue;
            const cj = ny * gridCols + nx;
            const s1 = cellStart[cj];
            const e1 = cellStart[cj + 1];
            for (let a = s0; a < e0; a++) {
              for (let b = s1; b < e1; b++) edge(cellNodes[a], cellNodes[b]);
            }
          }
        }
      }

      // ---- nodes (glow orbs — one drawAtlas over the white radial sprite) ----
      const touchActive = touchGlow > 0.01;
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];
        const bandE = state === "speaking" ? bands[n.band] : 0;
        // Nodes near the finger light up (local plexus response to touch).
        let touchNodeBoost = 0;
        if (touchActive) {
          const tdx = xs[i] - touch.x;
          const tdy = ys[i] - touch.y;
          const td = Math.sqrt(tdx * tdx + tdy * tdy);
          touchNodeBoost = touchGlow * clamp(1 - td / (R * 0.28), 0, 1) * 0.8;
        }
        const nodeEnergy = clamp(baseGlow + eEff * 0.5 + bandE + touchNodeBoost, 0, 1.6);
        const tw = 0.72 + 0.28 * Math.sin(ts * 2 + n.twPhase);
        const glowR = n.size * (1 + nodeEnergy * 2.2);
        const alpha = clamp(0.12 + nodeEnergy * 0.55, 0, 0.9) * tw;
        const hue = tHue(n.hue, thinking);
        const sat = state === "listening" ? 70 : thinking ? 80 : 92;
        const light = 62 + nodeEnergy * 14;
        if (glowSprite) {
          atlasXforms[i].set((glowR * 2) / SPRITE_SIZE, 0, xs[i] - glowR, ys[i] - glowR);
          hslaInto(atlasColors[i] as Float32Array, hue, sat, light, alpha);
        } else {
          // Sprite rasterization failed (drawAsImageFromPicture returned null) —
          // fall back to the per-node gradient draw.
          fill.setShader(
            Skia.Shader.MakeRadialGradient(
              Skia.Point(xs[i], ys[i]),
              glowR,
              [hsla(hue, sat, light, alpha), hsla(hue, sat, light, 0)],
              STOPS_2,
              TileMode.Clamp,
            ),
          );
          canvas.drawCircle(xs[i], ys[i], glowR, fill);
        }
      }
      if (glowSprite) {
        canvas.drawAtlas(glowSprite, atlasSrcs, atlasXforms, atlasPaint, BlendMode.Modulate, atlasColors);
      }

      // ---- particle dust ----
      fill.setShader(null);
      for (const p of particles) {
        const ang = p.a + Math.sin(ts * p.sp + p.ph) * 0.05;
        const rr = p.r * (1 + Math.sin(ts * 0.3 + p.ph) * 0.02);
        const px = cx + Math.cos(ang) * rr * spanX;
        const py = cy + Math.sin(ang) * rr * spanY * 0.9;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(ts * 1.5 + p.tw));
        const a = clamp(0.12 + energy * 0.3, 0, 0.5) * tw;
        fill.setColor(hsla(tHue(p.hue, thinking), 90, 70, a));
        canvas.drawCircle(px, py, p.sz * (0.8 + tw * 0.6), fill);
      }

      // ---- touch burst (a bright finger poke under your fingertip) ----
      if (touchActive) {
        const tr = R * (0.05 + 0.13 * touchGlow);
        const ta = 0.5 * touchGlow;
        fill.setShader(
          Skia.Shader.MakeRadialGradient(
            Skia.Point(touch.x, touch.y),
            tr,
            grad3(rgb3(255, 255, 255, ta), rgba(TEAL_RGB, ta * 0.7), rgba(TEAL_RGB, 0)),
            STOPS_04,
            TileMode.Clamp,
          ),
        );
        canvas.drawCircle(touch.x, touch.y, tr, fill);
        fill.setShader(null);
      }

      // ---- side waveform ribbons (stateAmp from the STATE_VIS table) ----
      const waveBright = clamp(0.35 + energy * 0.6, 0, 1);
      drawWave(ts, -1, stateAmp, waveBright);
      drawWave(ts, 1, stateAmp, waveBright);

      canvas.restore(); // composite the F16 layer ×GLOW_GAIN
      const pic = recorder.finishRecordingAsPicture();
      recorder.dispose();
      // roll the disposal window forward: stalePic (2 frames old) is off-screen now.
      stalePic?.dispose();
      stalePic = shownPic;
      shownPic = pic;
      setPicture(pic);
    }

    let raf = 0;
    let running = false;
    const loop = (t: number) => {
      render(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    let disposed = false;
    const appSub = AppState.addEventListener("change", (s) => {
      if (disposed) return;
      if (s === "active") start();
      else stop();
    });

    // Reduce Motion → a single static frame, no loop (mirrors the web).
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (disposed) return;
        if (rm) render(0);
        else start();
      })
      .catch(() => {
        if (!disposed) start();
      });

    return () => {
      disposed = true;
      stop();
      appSub.remove();
      // Loop stopped, so no more draws. stalePic is off-screen; shownPic is left for
      // GC (it may still be drawn for a beat during teardown — freeing it could
      // use-after-free).
      stalePic?.dispose();
    };
  }, [size, audioRef, touchRef]);

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        const prev = sizeRef.current;
        if (prev && prev.w === w && prev.h === h) return;
        sizeRef.current = { w, h };
        setSize({ w, h });
      }}
    >
      {size && picture ? (
        // opaque={false}: the Metal-backed Skia view must NOT composite over an
        // opaque black backing, or the transparent picture reads as a black box
        // over the app's aurora.
        <Canvas style={StyleSheet.absoluteFill} opaque={false}>
          <SkiaPicture picture={picture} />
        </Canvas>
      ) : null}
    </View>
  );
}
