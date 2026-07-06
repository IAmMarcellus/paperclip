/**
 * Mergatroid — hands-free voice call with the cross-company oversight agent.
 *
 * React Native port of the web Pipecat call surface (ui/src/components/oversight-call/
 * PipecatCall.tsx): the phone talks WebRTC directly to the self-hosted pipecat sidecar —
 * faster-whisper (CPU) → qwen-voice via the LiteLLM proxy → Kokoro (CPU) — with SDP/ICE signaling
 * relayed through Paperclip's admin-gated `/api/board/oversight/voice/offer` route (rides the same
 * base URL as every other API call). Audio then flows peer-to-peer over the tailnet/LAN; spoken
 * turns are persisted to the Conference Room thread server-side by the sidecar. No hosted voice
 * service, no cascade timeout, no per-minute billing.
 *
 * This build speaks ONLY the pipecat path: the transport's native WebRTC layer (Daily's
 * react-native-webrtc fork) is mutually exclusive with the LiveKit fork the old ElevenLabs SDK
 * used, so the server must run VOICE_PROVIDER=pipecat for mobile calls (the token response's
 * `provider` field surfaces the mismatch as a friendly error). The bot's remote audio track plays
 * automatically through the native audio session — no sink element needed on RN.
 */
import { PipecatClient, type Transport } from "@pipecat-ai/client-js";
import { DailyMediaManager } from "@pipecat-ai/react-native-daily-media-manager";
import { RNSmallWebRTCTransport } from "@pipecat-ai/react-native-small-webrtc-transport";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { AlertTriangle, Mic, MicOff, Phone, PhoneOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { NebulaCanvas, type NebulaTouch } from "@/components/voice/nebula/NebulaCanvas";
import { EMPTY, type NebulaAudio } from "@/components/voice/nebula/geometry";
import { PipecatNebulaAudio } from "@/components/voice/pipecatAudio";
import { ApiError, api } from "@/lib/api";
import { apiConfig } from "@/lib/config";
import { colors, fontFamily, radii, spacing, text } from "@/theme";

interface TranscriptLine {
  id: number;
  source: "user" | "ai";
  text: string;
}

type Phase = "connecting" | "speaking" | "thinking" | "listening" | "idle";

/** Per-call-phase status label + status-dot color. */
const PHASE: Record<Phase, { label: string; dot: string }> = {
  connecting: { label: "Connecting…", dot: colors.amber },
  speaking: { label: "Speaking…", dot: colors.teal },
  thinking: { label: "Thinking…", dot: colors.indigo },
  listening: { label: "Listening…", dot: colors.teal },
  idle: { label: "Ready to talk", dot: colors.dimForeground },
};

/** Map a token-mint / connection failure to a friendly, spoken-context message. */
function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "Voice isn't enabled for this instance.";
    if (err.status === 503) return "The voice service isn't running on the server (make voice).";
    if (err.status === 502) return "The server couldn't reach the voice service.";
    if (err.status === 409) return "Another call is already in progress — hang it up first.";
    return err.message || "Couldn't start the call.";
  }
  if (err instanceof Error) return err.message || "Couldn't start the call.";
  return "Couldn't start the call.";
}

export default function VoiceScreen() {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  // The brain is "thinking" from when your turn finalizes until it starts speaking — the visible cue
  // that buys the LLM's first-token latency without you barging in and killing the reply.
  const [agentThinking, setAgentThinking] = useState(false);
  const lineIdRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const touchRef = useRef<NebulaTouch>({ x: 0, y: 0, active: false });
  const clientRef = useRef<PipecatClient | null>(null);
  const nebulaAudio = useRef(new PipecatNebulaAudio()).current;

  const connecting = starting;
  const phase: Phase = connecting
    ? "connecting"
    : !connected
      ? "idle"
      : speaking
        ? "speaking"
        : agentThinking
          ? "thinking"
          : "listening";

  // Feed the nebula the same live state + audio getters the web Call surface uses. Refreshed on
  // every render (phase change); the getters read the adapter's live levels per animation frame.
  const audioRef = useRef<NebulaAudio | null>(null);
  audioRef.current = {
    state: phase,
    getOutputFreq: connected ? nebulaAudio.getOutputFreq : () => EMPTY,
    getOutputVolume: nebulaAudio.getOutputVolume,
    getInputVolume: nebulaAudio.getInputVolume,
  };

  const teardown = useCallback(() => {
    nebulaAudio.stop();
    clientRef.current = null;
    setConnected(false);
    setSpeaking(false);
    setAgentThinking(false);
    setMicEnabled(true);
  }, [nebulaAudio]);

  // Never leave the mic/call running behind a popped screen.
  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect().catch(() => {});
      nebulaAudio.stop();
    };
  }, [nebulaAudio]);

  useEffect(() => {
    if (transcript.length) scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript.length]);

  const startCall = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const token = await api.oversightVoiceToken();
      if (token.provider !== "pipecat") {
        throw new Error(
          "The server is set to the ElevenLabs voice provider — this build speaks the " +
            "self-hosted stack. Set VOICE_PROVIDER=pipecat and restart Paperclip.",
        );
      }

      const transport = new RNSmallWebRTCTransport({ mediaManager: new DailyMediaManager() });
      const client = new PipecatClient({
        // The RN transport is built against its own react-native-webrtc typings whose
        // MediaDeviceKind ("audio"/"video") differs from the DOM lib's — runtime-compatible,
        // type-incompatible. Same-version packages, so the cast is safe.
        transport: transport as unknown as Transport,
        enableMic: true,
        callbacks: {
          onConnected: () => {
            setConnected(true);
            setError(null);
            // Route bot audio to the loudspeaker (daily-js setAudioDevice under the hood — the
            // default route on iOS is the earpiece). Same call the official RN example makes.
            try {
              client.updateMic("SPEAKERPHONE");
            } catch {
              /* keep the default route */
            }
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
          // 500ms fallback writers behind the adapter's own ~120ms getStats poll.
          onLocalAudioLevel: nebulaAudio.onLocalLevel,
          onRemoteAudioLevel: (level) => nebulaAudio.onRemoteLevel(level),
        },
      });
      clientRef.current = client;
      nebulaAudio.start(transport);

      // The native layer requests mic permission when the session opens; a denial (or an
      // unreachable sidecar) surfaces as a connect rejection, caught below. The signaling endpoint
      // must be absolute on mobile — same Paperclip base URL every other API call uses.
      await client.connect({
        webrtcRequestParams: { endpoint: `${apiConfig.baseUrl}${token.offerPath}` },
      });
    } catch (err) {
      console.error("Oversight call (pipecat) failed to start:", err);
      teardown();
      setError(describeError(err));
    } finally {
      setStarting(false);
    }
  }, [nebulaAudio, teardown]);

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
    // so the button state can never diverge from what we told the SDK.
    setMicEnabled((prev) => {
      clientRef.current?.enableMic(!prev);
      return !prev;
    });
  }, []);

  const meta = PHASE[phase];

  return (
    <View
      style={styles.root}
      // Touch anywhere pokes the nebula. Handlers live on this outer wrapper — an
      // ancestor of everything Screen renders — so backdrop touches reach here in
      // full-screen coordinates that map 1:1 to the edge-to-edge nebula; the Call
      // button / transcript sit deeper and claim their own touches first.
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        touchRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, active: true };
      }}
      onResponderMove={(e) => {
        touchRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, active: true };
      }}
      onResponderRelease={() => {
        touchRef.current.active = false;
      }}
      onResponderTerminate={() => {
        touchRef.current.active = false;
      }}
    >
      <Screen
        title="Mergatroid"
        eyebrow="<REDACTED_ORG> · all companies"
        onBack={() => router.back()}
        scroll={false}
        bottomInset={spacing[6]}
        background={
          <>
            {/* Audio-reactive nebula — a TRUE full-bleed backdrop (edge-to-edge,
                behind the padded chrome), not an inset panel, + a legibility scrim. */}
            <NebulaCanvas audioRef={audioRef} touchRef={touchRef} />
            <LinearGradient
              colors={["rgba(8,8,10,0.35)", "rgba(8,8,10,0)", "rgba(8,8,10,0.7)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
        }
      >
        <View style={styles.body}>

        {/* Status chip */}
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: meta.dot }]} />
            <Text style={text.smallMedium}>Mergatroid</Text>
            {connecting ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : null}
            <Text style={text.small}>· {meta.label}</Text>
          </View>
        </View>

        {/* Transcript, or an empty-state hero before the first call */}
        {transcript.length > 0 ? (
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={false}
          >
            {transcript.map((line) => {
              const isUser = line.source === "user";
              return (
                <View
                  key={line.id}
                  style={[styles.bubbleRow, isUser ? styles.bubbleRight : styles.bubbleLeft]}
                >
                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                    <Text style={isUser ? [text.body, styles.userText] : text.body}>{line.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.hero}>
            <Text style={[text.body, styles.heroText]}>
              Talk to Mergatroid about the whole portfolio — status, blocked work, or spin up an issue in
              any company. Spoken turns are saved to the Conference Room thread.
            </Text>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.error}>
            <AlertTriangle size={16} color={colors.destructive} />
            <Text style={[text.small, styles.errorText]}>{error}</Text>
          </View>
        ) : null}

        {/* Call / End controls (+ mute while connected) */}
        <View style={styles.controls}>
          {connected || connecting ? (
            <View style={styles.controlRow}>
              <Pressable
                onPress={endCall}
                disabled={connecting && !connected}
                style={({ pressed }) => [
                  styles.callBtn,
                  { backgroundColor: colors.destructive },
                  pressed && styles.pressed,
                  connecting && !connected && styles.disabled,
                ]}
              >
                <PhoneOff size={18} color={colors.destructiveForeground} />
                <Text style={[styles.callLabel, { color: colors.destructiveForeground }]}>End call</Text>
              </Pressable>
              {connected ? (
                <Pressable
                  onPress={toggleMic}
                  style={({ pressed }) => [styles.muteBtn, pressed && styles.pressed]}
                  accessibilityLabel={micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {micEnabled ? (
                    <Mic size={18} color={colors.foregroundSoft} />
                  ) : (
                    <MicOff size={18} color={colors.destructive} />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={startCall}
              style={({ pressed }) => [
                styles.callBtn,
                { backgroundColor: colors.teal },
                pressed && styles.pressed,
              ]}
            >
              <Phone size={18} color={colors.primaryForeground} />
              <Text style={[styles.callLabel, { color: colors.primaryForeground }]}>Call Mergatroid</Text>
            </Pressable>
          )}
        </View>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, gap: spacing[4] },

  chipRow: { alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white05,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  transcript: { flex: 1 },
  transcriptContent: { gap: spacing[2], paddingVertical: spacing[2] },
  bubbleRow: { flexDirection: "row" },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.xl,
    borderCurve: "continuous",
  },
  aiBubble: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.white08 },
  userBubble: { backgroundColor: colors.secondary },
  userText: { color: colors.foregroundSoft },

  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[4] },
  heroText: { textAlign: "center", color: colors.mutedForeground },

  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
    backgroundColor: "rgba(244,63,94,0.12)",
  },
  errorText: { flex: 1, color: colors.destructive },

  controls: { alignItems: "center", paddingTop: spacing[2] },
  controlRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    height: 52,
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
    borderCurve: "continuous",
  },
  muteBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white05,
  },
  callLabel: { fontFamily: fontFamily.sansSemibold, fontSize: 16 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
