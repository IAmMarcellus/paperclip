// Stable per-agent signature colour.
//
// Aurora gives every agent a signature hue (Atlas = teal, Mercury = purple, …).
// We derive a stable 1..10 index from the agent's immutable `id` (NOT its
// position in a list — list order reshuffles on refetch/sort and would make the
// colour flicker). The index maps onto the brand `--agent-{n}a` / `--agent-{n}b`
// gradient pairs defined in `index.css` and already consumed by `AgentCapsule`.

const AGENT_GRADIENT_COUNT = 10;

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

/** The two CSS-var gradient stops for an agent (top → bottom). Internal helper. */
function agentGradientStops(agent: AgentLike): { from: string; to: string } {
  const i = agentGradientIndex(agent);
  return { from: `var(--agent-${i}a)`, to: `var(--agent-${i}b)` };
}

/** A ready-to-use `linear-gradient(...)` for the agent's signature colour. */
export function agentGradientCss(agent: AgentLike, angle = 180): string {
  const { from, to } = agentGradientStops(agent);
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

/** A single solid signature colour (the gradient's lower/ink stop). */
export function agentColorVar(agent: AgentLike): string {
  return `var(--agent-${agentGradientIndex(agent)}b)`;
}
