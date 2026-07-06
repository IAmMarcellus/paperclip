import { useQuery } from "@tanstack/react-query";
import { oversightVoiceApi } from "../api/oversightVoice";
import { queryKeys } from "../lib/queryKeys";
import { ElevenLabsCall } from "./oversight-call/ElevenLabsCall";
import { PipecatCall } from "./oversight-call/PipecatCall";

/**
 * <REDACTED_ORG> HQ "Call" surface — thin provider switcher. The server's VOICE_PROVIDER env picks
 * the stack: `elevenlabs` (hosted ASR/TTS + the Custom-LLM shim) or `pipecat` (fully self-hosted:
 * local whisper/Kokoro + the qwen-voice brain via the LiteLLM proxy). Both render the same
 * CallShell (nebula, captions, transcript); see components/oversight-call/.
 */
export function OversightCall() {
  const { data, isFetched } = useQuery({
    queryKey: queryKeys.instance.voiceConfig,
    queryFn: () => oversightVoiceApi.getConfig(),
  });

  if (!isFetched) return <div className="h-full w-full bg-background" />;
  // Config route unavailable (older server) — the hosted path is the safe default.
  return data?.provider === "pipecat" ? <PipecatCall /> : <ElevenLabsCall />;
}
