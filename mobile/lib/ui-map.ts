/** Map loose API rows onto the component view-models. */
import type { ActivityItem, ActivityKind } from "@/components/aurora/ActivityFeed";
import type { ActivityEntry, Agent, LiveRun } from "@/lib/api/types";
import { formatCents, humanize, relativeTime } from "@/lib/format";
import { colors } from "@/theme";

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

export function isWorkingAgent(agent: Pick<Agent, "status">): boolean {
  return agent.status === "running" || agent.status === "active";
}

export function agentDisplayRole(agent: Pick<Agent, "role" | "title">): string {
  return agent.title ?? `${humanize(agent.role)} Agent`;
}

export function agentModelLabel(agent: Agent): string {
  return (
    stringValue(agent.metadata, "model", "modelName", "primaryModel") ??
    stringValue(agent.adapterConfig, "model", "modelId") ??
    stringValue(agent.runtimeConfig, "model", "modelId") ??
    humanize(agent.adapterType)
  );
}

export function agentTaskText(agent: Agent, currentRun?: LiveRun | null): string {
  if (agent.errorReason) return agent.errorReason;

  const metadataTask = stringValue(
    agent.metadata,
    "currentTask",
    "current_task",
    "task",
    "taskTitle",
  );
  if (metadataTask) return metadataTask;

  if (currentRun && !isTerminalRun(currentRun.status)) {
    return `${humanize(currentRun.status)} run ${currentRun.id.slice(0, 8)}`;
  }

  if (agent.capabilities) return agent.capabilities;

  if (currentRun) return `${humanize(currentRun.status)} run ${currentRun.id.slice(0, 8)}`;

  return humanize(agent.adapterType);
}

export function agentMetric(agent: Agent): { value: string; label: string; warn?: boolean } {
  const cpu = percentFromMetadata(agent, "cpuPercent", "cpu", "computePercent");
  if (cpu != null) {
    return { value: `${cpu}%`, label: "cpu", warn: cpu >= 60 };
  }

  if (agent.spentMonthlyCents > 0) {
    return {
      value: formatCents(agent.spentMonthlyCents),
      label: "spent",
      warn: agent.budgetMonthlyCents > 0 && agent.spentMonthlyCents > agent.budgetMonthlyCents * 0.8,
    };
  }

  if (agent.lastHeartbeatAt) {
    return { value: relativeTime(String(agent.lastHeartbeatAt)), label: "seen" };
  }

  return { value: humanize(agent.status), label: "status" };
}

export function agentDetailStats(agent: Agent, runs: LiveRun[]) {
  const todaySpendCents = numberValue(agent.metadata, "todaySpendCents", "spendTodayCents");
  const taskCount = numberValue(agent.metadata, "tasksToday", "taskCountToday");
  const uptime = percentFromMetadata(agent, "uptimePercent", "uptime");
  const cpu = percentFromMetadata(agent, "cpuPercent", "cpu", "computePercent");
  const runsToday = runs.filter((run) => isToday(run.startedAt ?? run.createdAt)).length;

  return [
    todaySpendCents != null
      ? { value: formatCents(todaySpendCents), label: "Today spend", tint: colors.teal }
      : { value: formatCents(agent.spentMonthlyCents), label: "Spend / mo", tint: colors.teal },
    taskCount != null
      ? { value: String(Math.round(taskCount)), label: "Tasks today" }
      : runsToday > 0
        ? { value: String(runsToday), label: "Tasks today" }
        : { value: String(runs.length), label: "Runs" },
    uptime != null
      ? { value: `${uptime}%`, label: "Uptime" }
      : agent.lastHeartbeatAt
        ? { value: relativeTime(String(agent.lastHeartbeatAt)), label: "Seen" }
        : { value: humanize(agent.status), label: "Status" },
    cpu != null
      ? { value: `${cpu}%`, label: "Compute", tint: cpu >= 60 ? colors.amber : colors.indigo }
      : { value: agentModelLabel(agent), label: "Model", tint: colors.indigo },
  ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(source: unknown, ...keys: string[]): string | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function numberValue(source: unknown, ...keys: string[]): number | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function percentFromMetadata(agent: Agent, ...keys: string[]): number | null {
  const raw = numberValue(agent.metadata, ...keys);
  if (raw == null) return null;
  const value = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function isTerminalRun(status?: string | null): boolean {
  return !!status && /^(succeeded|failed|timed_out|cancelled|terminated|error|done|completed)$/.test(status);
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
