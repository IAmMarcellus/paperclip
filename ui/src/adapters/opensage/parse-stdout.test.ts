import { describe, expect, it } from "vitest";
import { parseOpenSageStdoutLine } from "./parse-stdout";

describe("parseOpenSageStdoutLine", () => {
  it("renders each streamed line as a stdout transcript entry", () => {
    const ts = "2026-06-19T00:00:00.000Z";
    expect(parseOpenSageStdoutLine("-> tool: opencode_run({})", ts)).toEqual([
      { kind: "stdout", ts, text: "-> tool: opencode_run({})" },
    ]);
  });
});
