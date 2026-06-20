import type { TranscriptEntry } from "../types";

// The OpenSage server adapter streams plain text plus "-> tool:" / "<- tool result:"
// marker lines via onLog. Render each line as stdout; the markers keep the
// orchestrator's tool activity (e.g. opencode_run) readable in the transcript.
export function parseOpenSageStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
