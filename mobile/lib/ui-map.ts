/** Map loose API rows onto the component view-models. */
import type { ActivityItem, ActivityKind } from "@/components/aurora/ActivityFeed";
import type { ActivityEntry } from "@/lib/api/types";
import { humanize, relativeTime } from "@/lib/format";

function kindFor(entry: ActivityEntry): ActivityKind {
  const hay = `${entry.type ?? ""} ${entry.kind ?? ""} ${entry.action ?? ""}`.toLowerCase();
  if (/approv|review|request/.test(hay)) return "approval";
  if (/error|fail|block/.test(hay)) return "error";
  if (/ship|complete|done|merge|resolve|success/.test(hay)) return "ship";
  if (/budget|cost|spend|billing/.test(hay)) return "budget";
  return "info";
}

function textFor(entry: ActivityEntry): string {
  return (
    entry.message ||
    entry.summary ||
    entry.title ||
    humanize(entry.action || entry.type || entry.kind) ||
    "Activity"
  );
}

export function mapActivity(entries: ActivityEntry[] | undefined): ActivityItem[] {
  if (!entries) return [];
  return entries.map((e) => ({
    id: e.id,
    kind: kindFor(e),
    agent: e.agentName ?? undefined,
    text: textFor(e),
    time: relativeTime(e.createdAt),
  }));
}
