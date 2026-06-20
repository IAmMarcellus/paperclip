import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { agentGradientCss } from "@/lib/agent-colors";

export interface AgentChipProps {
  agent: { id?: string | null; name?: string | null } | null | undefined;
  /** Override the displayed name (falls back to `agent.name`). */
  name?: string;
  className?: string;
  /** Trailing slot, e.g. a status ring. */
  trailing?: ReactNode;
}

/** An agent's signature-coloured gradient bar + name — consistent across every surface. */
export function AgentChip({ agent, name, className, trailing }: AgentChipProps) {
  const label = name ?? agent?.name ?? "—";
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-foreground/90", className)}>
      <span
        aria-hidden
        className="h-3.5 w-1 shrink-0 rounded-full"
        style={{ background: agentGradientCss(agent ?? name ?? "") }}
      />
      <span className="truncate">{label}</span>
      {trailing}
    </span>
  );
}
