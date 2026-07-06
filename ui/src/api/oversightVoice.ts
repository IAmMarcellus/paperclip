import { api } from "./client";

/** Which stack serves the call — mirrors the server's VOICE_PROVIDER env. */
export type VoiceProvider = "elevenlabs" | "pipecat";

export interface ElevenLabsVoiceToken {
  provider: "elevenlabs";
  /** Short-lived ElevenLabs signed WebSocket URL for the @elevenlabs/react client. */
  signedUrl: string;
  agentId: string;
}

export interface PipecatVoiceToken {
  provider: "pipecat";
  /** Same-origin SDP signaling path the @pipecat-ai/small-webrtc-transport client POSTs offers to. */
  offerPath: string;
}

export type OversightVoiceToken = ElevenLabsVoiceToken | PipecatVoiceToken;

export const oversightVoiceApi = {
  /** Which provider the server is configured for — picks the client component. */
  getConfig: () => api.get<{ provider: VoiceProvider }>("/board/oversight/voice/config"),
  // Server-side call setup. ElevenLabs: mints a signed URL (the API key never reaches the browser).
  // Pipecat: preflights the local sidecar and returns the signaling path. Gated by
  // enableVoiceChat + local_trusted + instance admin (see server/src/routes/board-chat.ts).
  getToken: () => api.post<OversightVoiceToken>("/board/oversight/voice/token", {}),
};
