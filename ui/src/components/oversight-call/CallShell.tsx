import { useEffect, useRef, type MutableRefObject } from "react";
import { AlertTriangle, ChevronUp, Loader2, Mic, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { NebulaCanvas, type NebulaAudio, type NebulaState } from "../NebulaCanvas";
import { cn } from "../../lib/utils";
import { useState } from "react";

/**
 * Presentational shell for the HQ "Call" surface — the audio-reactive nebula, status chip, floating
 * code snippets, captions, controls, and transcript overlay. Provider-agnostic: both the ElevenLabs
 * call and the self-hosted Pipecat call render through this, feeding it state + a NebulaAudio ref.
 */

export interface TranscriptLine {
  id: number;
  source: "user" | "ai";
  text: string;
}

export interface CallShellProps {
  audioRef: MutableRefObject<NebulaAudio>;
  connected: boolean;
  connecting: boolean;
  speaking: boolean;
  /** The brain is "thinking" from user-turn end until it starts speaking. */
  thinking: boolean;
  error: string | null;
  transcript: TranscriptLine[];
  onStart: () => void;
  onEnd: () => void;
  /** When provided, renders a mute toggle (Pipecat path; the ElevenLabs SDK has no mic toggle here). */
  micEnabled?: boolean;
  onToggleMic?: () => void;
}

/** Single place the call phase is derived from the connection booleans — callers reuse it for the
 *  nebula audio ref so the canvas and the shell can never disagree. */
export function deriveCallPhase(s: {
  connecting: boolean;
  connected: boolean;
  speaking: boolean;
  thinking: boolean;
}): NebulaState {
  if (s.connecting) return "connecting";
  if (!s.connected) return "idle";
  if (s.speaking) return "speaking";
  return s.thinking ? "thinking" : "listening";
}

/** Per-call-phase status label + status-dot color, derived from the single `NebulaState`. */
const PHASE: Record<NebulaState, { label: string; dot: string }> = {
  connecting: { label: "Connecting…", dot: "bg-amber" },
  speaking: { label: "Speaking…", dot: "bg-teal" },
  thinking: { label: "Thinking…", dot: "bg-indigo" },
  listening: { label: "Listening…", dot: "bg-teal" },
  idle: { label: "Ready to talk", dot: "bg-muted-foreground" },
};

/** On-theme floating code, echoing the reference image (the agent's own loop). Positioned around the
 *  edges; the whole layer fades in on connect and brightens while Mergatroid speaks. */
const CODE_SNIPPETS: { id: string; text: string; className: string }[] = [
  {
    id: "core",
    text: "synapse.core.v1\nstate: active\nmode: conversational\nconfidence: 0.98",
    className: "left-5 top-20 text-teal sm:left-10",
  },
  {
    id: "loop",
    text: "listen();\nunderstand();\nreflect();\nrespond();\nevolve();",
    className: "right-5 top-20 text-indigo sm:right-10",
  },
  {
    id: "neuron",
    text: "neuron.fire();\nsignals.flow();\nweights.adjust();\nfuture.shape();",
    className: "bottom-32 left-5 text-rose sm:left-10",
  },
  {
    id: "intent",
    text: '"intent": "explore",\n"emotion": "curious",\n"drive": "understand",\n"tone": "warm"',
    className: "bottom-32 right-5 text-emerald sm:right-10",
  },
  {
    id: "embed",
    text: "[0.03, 0.41, 0.92, 0.67, …]\n// semantic embedding",
    className: "right-6 top-1/2 hidden text-teal/80 lg:block",
  },
];

function CodeSnippets({ connected, speaking }: { connected: boolean; speaking: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 select-none font-mono text-[10px] leading-relaxed transition-opacity duration-700 sm:text-xs",
        connected ? (speaking ? "opacity-100" : "opacity-60") : "opacity-0",
      )}
    >
      {CODE_SNIPPETS.map((snippet, i) => (
        <pre
          key={snippet.id}
          className={cn("nebula-code absolute m-0 whitespace-pre", snippet.className)}
          style={{ animationDelay: `${i * 0.7}s` }}
        >
          {snippet.text}
        </pre>
      ))}
    </div>
  );
}

export function CallShell({
  audioRef,
  connected,
  connecting,
  speaking,
  thinking,
  error,
  transcript,
  onStart,
  onEnd,
  micEnabled,
  onToggleMic,
}: CallShellProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nebulaState = deriveCallPhase({ connecting, connected, speaking, thinking });

  useEffect(() => {
    if (showTranscript) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [transcript.length, showTranscript]);

  const phase = PHASE[nebulaState];
  const captionLines = transcript.slice(-2);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <NebulaCanvas audioRef={audioRef} className="absolute inset-0" />

      {/* Keep overlay text legible over the glow. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/70" />

      <CodeSnippets connected={connected} speaking={speaking} />

      {/* Status chip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-6 pt-6">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-sm font-medium text-foreground/90 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            {connected && (speaking || nebulaState === "thinking") ? (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full",
                  speaking ? "bg-teal/70" : "bg-indigo/70",
                )}
              />
            ) : null}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", phase.dot)} />
          </span>
          <span>Mergatroid</span>
          {connecting ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
          <span className="text-muted-foreground">· {phase.label}</span>
        </div>
      </div>

      {/* Bottom controls + live captions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-8">
        {error ? (
          <div
            role="alert"
            className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm text-destructive backdrop-blur-md"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {captionLines.length > 0 ? (
          <div className="flex w-full max-w-xl flex-col items-center gap-1 text-center">
            {captionLines.map((line) => (
              <p
                key={line.id}
                className={cn(
                  "max-w-xl text-balance text-sm",
                  line.source === "user" ? "italic text-foreground/55" : "text-foreground/95",
                )}
              >
                {line.source === "user" ? "“" + line.text + "”" : line.text}
              </p>
            ))}
          </div>
        ) : !connected && !connecting ? (
          <p className="max-w-md text-center text-xs text-muted-foreground">
            Start a call to talk to Mergatroid about the whole portfolio. Spoken turns are saved to the
            Conference Room thread.
          </p>
        ) : null}

        <div className="pointer-events-auto flex items-center gap-3">
          {connected || connecting ? (
            <>
              {onToggleMic && connected ? (
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur-md transition-colors",
                    micEnabled
                      ? "bg-black/40 text-foreground/80 hover:text-foreground"
                      : "bg-amber/20 text-amber",
                  )}
                  aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  {micEnabled ? "Mute" : "Unmute"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEnd}
                disabled={connecting && !connected}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <PhoneOff className="h-4 w-4" />
                End call
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal/20 transition-opacity hover:opacity-90"
            >
              <Phone className="h-4 w-4" />
              Call Mergatroid
            </button>
          )}

          {transcript.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowTranscript(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground/80 backdrop-blur-md transition-colors hover:text-foreground"
            >
              <ChevronUp className="h-4 w-4" />
              Transcript
            </button>
          ) : null}
        </div>
      </div>

      {/* Expandable full transcript */}
      {showTranscript ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-background/85 backdrop-blur-xl">
          <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-sm font-semibold">Transcript</h3>
            <button
              type="button"
              onClick={() => setShowTranscript(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close transcript"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-2">
              {transcript.map((line) => {
                const isUser = line.source === "user";
                return (
                  <div key={line.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm",
                        isUser
                          ? "rounded-br-sm bg-blue-600 text-white"
                          : "rounded-bl-sm border border-border bg-card text-foreground",
                      )}
                    >
                      {line.text}
                    </div>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
