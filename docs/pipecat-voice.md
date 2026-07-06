# Self-hosted voice (Pipecat): the local "Call Mergatroid" stack

The **Call** tab can run on one of two providers, selected by the Paperclip server's
`VOICE_PROVIDER` env var:

- **`elevenlabs`** (default) - hosted ASR/turn-taking/TTS; the LLM is a Custom-LLM shim driving the
  local voice brain.
- **`pipecat`** - fully self-hosted (this doc). No hosted service, no stall cap, no keep-alives.
  Web client only; **mobile always uses ElevenLabs** regardless of the switch.

## Architecture

```
Browser (ui/src/components/oversight-call/PipecatCall.tsx, @pipecat-ai/client-js + small-webrtc)
   │  POST/PATCH /api/board/oversight/voice/offer   (same-origin signaling relay, admin-gated)
   ▼
Paperclip server (server/src/routes/board-chat.ts) ──relay──► Pipecat sidecar (TitanOfIndustry voice/)
   ▲                                                             │ Silero VAD + SmartTurn v3 (CPU)
   │  GET /voice/digest, POST /voice/messages (loopback,         │ faster-whisper STT (CPU)
   │  implicit admin), read-only tool GETs                       │ qwen-voice ◄─ LiteLLM proxy
   └─────────────────────────────────────────────────────────────┤ Kokoro TTS (CPU)
                     audio flows browser ↔ sidecar over WebRTC ──┘
```

The sidecar lives in the TitanOfIndustry repo at `voice/` (standalone uv project). STT/TTS/VAD and
turn detection run on CPU; the voice brain uses the configured local LLM route.

## Server surface (all gated: `enableVoiceChat` + `local_trusted` + instance admin)

| Route | Purpose |
|---|---|
| `GET /api/board/oversight/voice/config` | `{provider}` — picks the client component |
| `POST /api/board/oversight/voice/token` | pipecat: preflights sidecar `/health`, returns `{provider, offerPath}`; elevenlabs: unchanged signed-URL mint |
| `POST/PATCH /api/board/oversight/voice/offer` | relays SDP offers / trickle ICE to the sidecar |
| `GET /api/board/oversight/voice/digest` | live cross-company status snapshot for the sidecar's system prompt |
| `POST /api/board/oversight/voice/messages` | sidecar persists finalized spoken turns to the Conference Room thread |

## The brain

`qwen-voice` is a LiteLLM proxy alias for the local voice model. Tools support read-only status
queries and confirmation-gated writes such as creating issues, adding comments, and updating issue
status. Approval actions are intentionally not exposed through voice.

Latency notes: the digest + trimmed prompt keep prefill small, tool results are slimmed hard, and a
spoken filler ("Let me check that.") covers tool rounds. Ollama still serializes generations on the
one GPU, so a voice turn that lands mid coder-generation waits for it — that's the residual wait the
filler UX carries.

## Run it

```bash
# one-time: models download on first start
make voice
make stack ARGS='--with-voice'

# flip the provider, then restart paperclip:
VOICE_PROVIDER=pipecat
```

Knobs are the `VOICE_*` group in TitanOfIndustry's `.env.example`. Always-on alternative:
`deploy/mergatroid-voice.service` (systemd --user).

Rollback: set `VOICE_PROVIDER=elevenlabs` (or unset), restart Paperclip. The ElevenLabs path is
untouched and mobile never left it.

## Known limits (v1)

- WebRTC reachability depends on the local network configuration.
- One concurrent call (`ConnectionMode.SINGLE` — second offer gets 409).
- Kokoro is a clear step down from ElevenLabs on prosody; swap voices via `VOICE_KOKORO_VOICE`.
