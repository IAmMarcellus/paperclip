import { useCallback, useEffect, useRef, useState } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { oversightVoiceApi } from "../../api/oversightVoice";
import { EMPTY, idleNebulaAudio, type NebulaAudio } from "../NebulaCanvas";
import { CallShell, deriveCallPhase, type TranscriptLine } from "./CallShell";

/**
 * The self-hosted (Pipecat) call path. The browser talks WebRTC to the local pipecat sidecar —
 * signaling is relayed through Paperclip's admin-gated `/api/board/oversight/voice/offer` route
 * (same-origin, so the session cookie carries the auth), then audio flows peer-to-peer. The
 * pipeline behind it is faster-whisper (CPU) → qwen-voice via the LiteLLM proxy → Kokoro (CPU); no
 * hosted service, no cascade timeout, and spoken turns are persisted server-side by the sidecar.
 */

interface TapNode {
  analyser: AnalyserNode;
  bins: Uint8Array<ArrayBuffer>;
}

/** Analyser wrapper: NebulaAudio getters over WebAudio AnalyserNodes on the live tracks. */
class TrackAnalysers {
  private ctx: AudioContext | null = null;
  private bot: TapNode | null = null;
  private mic: TapNode | null = null;

  private attach(track: MediaStreamTrack): TapNode {
    this.ctx ??= new AudioContext();
    const source = this.ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256; // 128 bins — same granularity the ElevenLabs getter returns
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    return { analyser, bins: new Uint8Array(analyser.frequencyBinCount) };
  }

  setBotTrack(track: MediaStreamTrack) {
    this.bot = this.attach(track);
  }

  setMicTrack(track: MediaStreamTrack) {
    this.mic = this.attach(track);
  }

  private static volume(tap: TapNode): number {
    tap.analyser.getByteFrequencyData(tap.bins);
    let sum = 0;
    for (let i = 0; i < tap.bins.length; i++) sum += tap.bins[i] * tap.bins[i];
    return Math.sqrt(sum / tap.bins.length) / 255; // RMS, normalized 0..1
  }

  getOutputFreq = (): Uint8Array => {
    if (!this.bot) return EMPTY;
    this.bot.analyser.getByteFrequencyData(this.bot.bins);
    return this.bot.bins;
  };

  getOutputVolume = (): number => (this.bot ? TrackAnalysers.volume(this.bot) : 0);

  getInputVolume = (): number => (this.mic ? TrackAnalysers.volume(this.mic) : 0);

  close() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.bot = null;
    this.mic = null;
  }
}

export function PipecatCall() {
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const lineIdRef = useRef(0);
  const clientRef = useRef<PipecatClient | null>(null);
  const analysersRef = useRef<TrackAnalysers | null>(null);
  const botAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<NebulaAudio>(idleNebulaAudio());

  const analysers = analysersRef.current;
  audioRef.current = {
    state: deriveCallPhase({ connecting, connected, speaking, thinking: agentThinking }),
    getOutputFreq: analysers ? analysers.getOutputFreq : () => EMPTY,
    getOutputVolume: analysers ? analysers.getOutputVolume : () => 0,
    getInputVolume: analysers ? analysers.getInputVolume : () => 0,
  };

  const teardown = useCallback(() => {
    analysersRef.current?.close();
    analysersRef.current = null;
    if (botAudioRef.current) {
      botAudioRef.current.srcObject = null;
    }
    clientRef.current = null;
    setConnected(false);
    setConnecting(false);
    setSpeaking(false);
    setAgentThinking(false);
    setMicEnabled(true);
  }, []);

  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect().catch(() => {});
      analysersRef.current?.close();
    };
  }, []);

  const startCall = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const token = await oversightVoiceApi.getToken();
      if (token.provider !== "pipecat") {
        throw new Error("Voice provider changed — reload the page.");
      }

      const analysersLocal = new TrackAnalysers();
      analysersRef.current = analysersLocal;

      const client = new PipecatClient({
        transport: new SmallWebRTCTransport(),
        enableMic: true,
        callbacks: {
          onConnected: () => {
            setConnected(true);
            setError(null);
          },
          onDisconnected: () => teardown(),
          onError: () => setError("Voice connection error."),
          onBotStartedSpeaking: () => {
            setSpeaking(true);
            setAgentThinking(false);
          },
          onBotStoppedSpeaking: () => setSpeaking(false),
          onUserTranscript: (data) => {
            if (!data.final || !data.text.trim()) return;
            setTranscript((prev) => [
              ...prev,
              { id: lineIdRef.current++, source: "user", text: data.text },
            ]);
            setAgentThinking(true);
          },
          onBotTranscript: (data) => {
            if (!data.text.trim()) return;
            setTranscript((prev) => [
              ...prev,
              { id: lineIdRef.current++, source: "ai", text: data.text },
            ]);
          },
          onTrackStarted: (track, participant) => {
            if (track.kind !== "audio") return;
            if (participant?.local) {
              analysersLocal.setMicTrack(track);
              return;
            }
            // Bot audio: analyse for the nebula AND play it (client-js does not auto-attach).
            analysersLocal.setBotTrack(track);
            if (botAudioRef.current) {
              botAudioRef.current.srcObject = new MediaStream([track]);
              void botAudioRef.current.play().catch(() => {});
            }
          },
        },
      });
      clientRef.current = client;
      await client.connect({ webrtcRequestParams: { endpoint: token.offerPath } });
    } catch (err) {
      console.error("Oversight call (pipecat) failed to start:", err);
      teardown();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone permission denied — allow mic access to talk to Mergatroid.");
      } else if (err instanceof Error) {
        setError(err.message || "Couldn't start the call.");
      } else {
        setError("Couldn't start the call.");
      }
    } finally {
      setConnecting(false);
    }
  }, [teardown]);

  const endCall = useCallback(async () => {
    try {
      await clientRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    teardown();
  }, [teardown]);

  const toggleMic = useCallback(() => {
    // Single source of truth: derive the next value from our own state and push it to the client,
    // so the button label can never diverge from what we told the SDK.
    setMicEnabled((prev) => {
      clientRef.current?.enableMic(!prev);
      return !prev;
    });
  }, []);

  return (
    <>
      {/* Hidden sink for the bot's remote audio track. */}
      <audio ref={botAudioRef} autoPlay className="hidden" />
      <CallShell
        audioRef={audioRef}
        connected={connected}
        connecting={connecting}
        speaking={speaking}
        thinking={agentThinking}
        error={error}
        transcript={transcript}
        onStart={startCall}
        onEnd={endCall}
        micEnabled={micEnabled}
        onToggleMic={toggleMic}
      />
    </>
  );
}
