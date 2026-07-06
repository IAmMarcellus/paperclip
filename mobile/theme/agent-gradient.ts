/**
 * Stable per-agent signature gradient.
 *
 * Ported from vendor/paperclip/ui/src/lib/agent-colors.ts. We derive a stable
 * 1..10 index from the agent's immutable `id` (FNV-1a) so the colour never
 * flickers on refetch/sort, then map it to the brand `--agent-{n}a/b` gradient
 * pairs defined in ui/src/index.css.
 */

const AGENT_GRADIENT_COUNT = 10;

/** The 10 brand gradient stop pairs (top → bottom), from index.css. */
export const AGENT_GRADIENTS: readonly [string, string][] = [
  ["#f7cfdc", "#1f7a3a"], // 1
  ["#c9a9e8", "#ee79a1"], // 2
  ["#28164b", "#7a1530"], // 3
  ["#f3e6c4", "#e3a21a"], // 4
  ["#1f4dd6", "#3aa35c"], // 5
  ["#e94b27", "#5a1122"], // 6
  ["#7eb6e3", "#ee79a1"], // 7
  ["#9ce8a7", "#bd7ff0"], // 8
  ["#f3b49e", "#1f4ed4"], // 9
  ["#f2d95f", "#4fbcba"], // 10
];

type AgentLike = { id?: string | null; name?: string | null } | string | null | undefined;

function keyFor(agent: AgentLike): string {
  if (typeof agent === "string") return agent;
  return agent?.id ?? agent?.name ?? "";
}

/** Deterministic FNV-1a hash → gradient index in `1..AGENT_GRADIENT_COUNT`. */
export function agentGradientIndex(agent: AgentLike): number {
  const key = keyFor(agent);
  if (!key) return 1;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % AGENT_GRADIENT_COUNT) + 1;
}

/** The two gradient stops (top → bottom) for an agent's signature colour. */
export function agentGradientStops(agent: AgentLike): readonly [string, string] {
  return AGENT_GRADIENTS[agentGradientIndex(agent) - 1];
}

/** A single solid signature colour (the gradient's lower/ink stop). */
export function agentColor(agent: AgentLike): string {
  return agentGradientStops(agent)[1];
}
