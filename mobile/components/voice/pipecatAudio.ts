/**
 * NebulaAudio plumbing for the Pipecat (SmallWebRTC) call path.
 *
 * React Native has no WebAudio AnalyserNode, so the web client's per-track analysers
 * (ui/src/components/oversight-call/PipecatCall.tsx) can't be ported:
 *
 * - **Volumes** come from WebRTC stats: `media-source.audioLevel` (mic) and
 *   `inbound-rtp.audioLevel` (bot), polled off the transport's RTCPeerConnection every POLL_MS.
 *   The transport's built-in AudioLevelObserver reports the same numbers but at a fixed 500ms —
 *   too coarse for the 60fps nebula — so we poll ourselves and keep the observer's
 *   `onLocalAudioLevel`/`onRemoteAudioLevel` callbacks wired as a fallback writer into the same
 *   fields (last writer wins; if `pc.getStats()` ever stops yielding audioLevel on some iOS
 *   version, the nebula degrades to 500ms updates instead of freezing).
 *
 * - **The frequency spectrum is synthesized.** No spectrum exists on RN, and the nebula's
 *   waveform ribbons + per-node pulses sample bands during speech. We shape a 48-bin
 *   pseudo-spectrum from the bot volume: a speech-like falling envelope times a slow band-local
 *   wobble, so the ribbons keep their organic motion. Silence → all-zero bands → the same flat
 *   ribbons the real spectrum produces (and EMPTY stays the disconnected path).
 */
import type { RNSmallWebRTCTransport } from "@pipecat-ai/react-native-small-webrtc-transport";

const POLL_MS = 120;
const BAND_COUNT = 48;

/** Map a linear WebRTC audioLevel (speech ≈ 0.05–0.35) to the ~0–1 range the nebula expects
 *  (the web analyser's RMS sits around 0.2–0.5 while speaking). */
function mapLevel(level: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, level)) * 1.2);
}

/** Minimal view of the WebRTC stats we read — the Daily fork returns a Map-like report. */
interface AudioStat {
  type?: string;
  kind?: string;
  mediaType?: string;
  audioLevel?: number;
}

export class PipecatNebulaAudio {
  private transport: RNSmallWebRTCTransport | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private outVol = 0;
  private inVol = 0;
  private bands = new Uint8Array(BAND_COUNT);

  start(transport: RNSmallWebRTCTransport): void {
    this.transport = transport;
    this.timer ??= setInterval(() => void this.poll(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.transport = null;
    this.outVol = 0;
    this.inVol = 0;
    this.bands.fill(0);
  }

  /** Fallback writers — wire to the client's onLocalAudioLevel / onRemoteAudioLevel callbacks. */
  onLocalLevel = (level: number): void => {
    this.inVol = mapLevel(level);
  };
  onRemoteLevel = (level: number): void => {
    this.outVol = mapLevel(level);
  };

  private async poll(): Promise<void> {
    if (this.polling) return; // getStats slower than the tick — skip, don't stack
    // The transport keeps its RTCPeerConnection private and swaps it on reconnection — read it
    // fresh each tick. Everything below is defensive: on any miss the 500ms callbacks carry us.
    const pc = (this.transport as unknown as { pc?: { getStats(): Promise<unknown> } } | null)?.pc;
    if (!pc) return;
    this.polling = true;
    try {
      const report = (await pc.getStats()) as { forEach(cb: (stat: AudioStat) => void): void };
      report.forEach((stat) => {
        if (typeof stat.audioLevel !== "number") return;
        const kind = stat.kind ?? stat.mediaType;
        if (kind !== "audio") return;
        if (stat.type === "inbound-rtp") this.outVol = mapLevel(stat.audioLevel);
        else if (stat.type === "media-source") this.inVol = mapLevel(stat.audioLevel);
      });
    } catch {
      /* fall back to the observer callbacks */
    } finally {
      this.polling = false;
    }
  }

  getOutputVolume = (): number => this.outVol;
  getInputVolume = (): number => this.inVol;

  /** Synthesized pseudo-spectrum: speech-like falling envelope × slow per-band wobble × volume. */
  getOutputFreq = (): Uint8Array => {
    const vol = Math.min(1, this.outVol * 1.6);
    if (vol < 0.02) {
      this.bands.fill(0);
      return this.bands;
    }
    const t = Date.now() / 1000;
    for (let i = 0; i < BAND_COUNT; i++) {
      const fr = i / (BAND_COUNT - 1);
      // Two incommensurate sines give a non-repeating band-local shimmer in [0, 1].
      const wobble = 0.5 + 0.5 * Math.sin(t * 7.3 + i * 0.9) * Math.sin(t * 3.1 - i * 0.45);
      const envelope = Math.pow(1 - fr, 0.6) * (0.55 + 0.45 * wobble);
      this.bands[i] = (255 * vol * envelope) | 0;
    }
    return this.bands;
  };
}
