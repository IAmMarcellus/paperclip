import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { oversightVoiceApi } from "../../api/oversightVoice";
import { EMPTY, idleNebulaAudio, type NebulaAudio } from "../NebulaCanvas";
import { CallShell, deriveCallPhase, type TranscriptLine } from "./CallShell";

/**
 * The hosted (ElevenLabs) call path — behavior-identical to the original OversightCall: ElevenLabs
 * owns ASR / turn-taking / barge-in / TTS, and its "LLM" is our Custom-LLM shim
 * (`/api/board/oversight/llm/chat/completions`). The browser connects with a short-lived signed URL
 * minted server-side (the API key never reaches the client). `useConversation` must live under a
 * `ConversationProvider`, so the exported component is a thin provider wrapper.
 */

/** Wrap an SDK accessor so a call before/after a session falls back instead of throwing. */
const safe =
  <T,>(fn: () => T, fallback: T) =>
  () => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

function ElevenLabsCallInner() {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  // The brain is "thinking" from when your turn finalizes until it starts speaking — the
  // visible cue that buys the LLM's first-token latency without you barging in and killing the reply.
  const [agentThinking, setAgentThinking] = useState(false);
  const lineIdRef = useRef(0);
  const audioRef = useRef<NebulaAudio>(idleNebulaAudio());

  const conversation = useConversation({
    onConnect: () => setError(null),
    onError: (message) =>
      setError(typeof message === "string" && message ? message : "Voice connection error."),
    onMessage: (props) => {
      if (!props?.message) return;
      const source = props.source === "user" ? "user" : "ai";
      setTranscript((prev) => [...prev, { id: lineIdRef.current++, source, text: props.message }]);
      // A finalized user turn means the brain is now thinking; an AI line means it has answered.
      setAgentThinking(source === "user");
    },
  });

  const status = conversation.status;
  const connected = status === "connected";
  const connecting = status === "connecting" || starting;
  const speaking = conversation.isSpeaking;

  // Feed the nebula the live audio every render via a ref (no per-frame re-render). The getters are
  // wrapped because the SDK methods throw before/after a session; the canvas only calls the ones that
  // match the current state, so these throw-guards are belt-and-suspenders.
  audioRef.current = {
    state: deriveCallPhase({ connecting, connected, speaking, thinking: agentThinking }),
    getOutputFreq: safe(() => conversation.getOutputByteFrequencyData(), EMPTY),
    getOutputVolume: safe(() => conversation.getOutputVolume(), 0),
    getInputVolume: safe(() => conversation.getInputVolume(), 0),
  };

  // Resolve "thinking" the moment Mergatroid starts speaking, and never let it linger after a call ends.
  useEffect(() => {
    if (speaking) setAgentThinking(false);
  }, [speaking]);
  useEffect(() => {
    if (!connected) setAgentThinking(false);
  }, [connected]);

  const startCall = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      // Microphone permission must be granted before the realtime session opens.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const token = await oversightVoiceApi.getToken();
      if (token.provider !== "elevenlabs") {
        throw new Error("Voice provider changed — reload the page.");
      }
      await conversation.startSession({ signedUrl: token.signedUrl });
    } catch (err) {
      console.error("Oversight call failed to start:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone permission denied — allow mic access to talk to Mergatroid.");
      } else if (err instanceof Error) {
        setError(err.message || "Couldn't start the call.");
      } else {
        setError("Couldn't start the call.");
      }
    } finally {
      setStarting(false);
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      /* already disconnected */
    }
  }, [conversation]);

  return (
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
    />
  );
}

export function ElevenLabsCall() {
  return (
    <ConversationProvider>
      <ElevenLabsCallInner />
    </ConversationProvider>
  );
}
