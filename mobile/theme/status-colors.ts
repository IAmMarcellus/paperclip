/**
 * Status / priority colours for mobile.
 *
 * Ported from vendor/paperclip/ui/src/lib/status-colors.ts, resolved to concrete
 * hex values (the web uses Tailwind classes). Agent status visuals follow the
 * Aurora mobile mockup (teal "working", emerald "online", gray idle, rose error).
 */
import { colors } from "./tokens";

export interface AgentStatusVisual {
  /** Dot / capsule colour. */
  color: string;
  /** Whether the indicator animates (running pulses, error blinks). */
  animate: boolean;
  /** Human label. */
  label: string;
}

/** Agent runtime status → indicator. Unknown → idle. */
export const agentStatusVisual: Record<string, AgentStatusVisual> = {
  running: { color: colors.teal, animate: true, label: "Working" },
  active: { color: colors.emerald, animate: false, label: "Online" },
  idle: { color: colors.statusIdle, animate: false, label: "Idle" },
  paused: { color: colors.amber, animate: false, label: "Paused" },
  scheduled_retry: { color: colors.sky, animate: true, label: "Retrying" },
  error: { color: colors.rose, animate: true, label: "Error" },
  archived: { color: colors.statusIdle, animate: false, label: "Archived" },
};

export const agentStatusVisualDefault: AgentStatusVisual = {
  color: colors.statusIdle,
  animate: false,
  label: "Idle",
};

export function getAgentStatusVisual(status?: string | null): AgentStatusVisual {
  return (status && agentStatusVisual[status]) || agentStatusVisualDefault;
}

// ---------------------------------------------------------------------------
// Brand chip colours (issue / approval / run status) — dark-mode hex
// ---------------------------------------------------------------------------

export type BrandChipColor = "gray" | "blue" | "amber" | "green" | "violet" | "red";

export interface ChipStyle {
  bg: string;
  text: string;
  border: string;
}

export const brandChip: Record<BrandChipColor, ChipStyle> = {
  gray: { bg: "#6e696024", text: "#9A958A", border: "#9e958a73" },
  blue: { bg: "#2563eb2e", text: "#2563EB", border: "#2563eb73" },
  amber: { bg: "#f59e0b24", text: "#F59E0B", border: "#f59e0b73" },
  green: { bg: "#22c55e1f", text: "#22C55E", border: "#22c55e73" },
  violet: { bg: "#7c3aed2e", text: "#7C3AED", border: "#7c3aed73" },
  red: { bg: "#dc26262e", text: "#DC2626", border: "#dc262673" },
};

/** Issue/task status → brand colour (PAP-75: in_progress=blue, todo=amber, …). */
export const issueStatusColor: Record<string, BrandChipColor> = {
  backlog: "gray",
  todo: "amber",
  in_progress: "blue",
  in_review: "violet",
  done: "green",
  blocked: "red",
  cancelled: "gray",
};

/** Run / approval status → brand colour. */
export const runStatusColor: Record<string, BrandChipColor> = {
  queued: "gray",
  pending: "amber",
  pending_approval: "amber",
  revision_requested: "amber",
  running: "blue",
  in_progress: "blue",
  succeeded: "green",
  ok: "green",
  approved: "green",
  done: "green",
  completed: "green",
  failed: "red",
  error: "red",
  rejected: "red",
  terminated: "red",
  timed_out: "amber",
  cancelled: "gray",
};

export function chipFor(
  map: Record<string, BrandChipColor>,
  status?: string | null,
): ChipStyle {
  return brandChip[(status && map[status]) || "gray"];
}

// ---------------------------------------------------------------------------
// Priority (dark-mode hex, Tailwind *-400)
// ---------------------------------------------------------------------------

export const priorityColor: Record<string, string> = {
  critical: "#f87171",
  high: "#fb923c",
  medium: "#facc15",
  low: "#60a5fa",
};

export const priorityColorDefault = "#facc15";
