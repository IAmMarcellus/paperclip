/**
 * Data hooks (TanStack Query) over the Paperclip API. List hooks poll while the
 * screen is mounted; the run hooks poll faster until the run reaches a terminal
 * status.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ActivityEntry,
  Agent,
  AgentDetail,
  Approval,
  HeartbeatRun,
  HeartbeatRunEvent,
  Issue,
  LiveRun,
  OrgNode,
} from "@/lib/api/types";

const TERMINAL = new Set([
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "terminated",
  "error",
  "done",
  "completed",
]);

export function isTerminal(status?: string | null): boolean {
  return !!status && TERMINAL.has(status);
}

/** Active-ratio summary used by the Home + Org objective cards. */
export function agentWorkSummary(agents: Agent[] | undefined): {
  ratio: number;
  value: string;
  context: string;
} {
  const all = agents ?? [];
  const working = all.filter((a) => a.status === "running" || a.status === "active").length;
  const ratio = all.length ? working / all.length : 0;
  return {
    ratio,
    value: `${Math.round(ratio * 100)}%`,
    context: `${working} of ${all.length} agents active`,
  };
}

// --- lists ----------------------------------------------------------------

export function useAgents(companyId: string): UseQueryResult<Agent[]> {
  return useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => api.listAgents(companyId),
    refetchInterval: 8000,
  });
}

export function useAgent(id: string): UseQueryResult<AgentDetail> {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.getAgent(id),
    refetchInterval: 6000,
  });
}

export function useOrg(companyId: string): UseQueryResult<OrgNode[]> {
  return useQuery({
    queryKey: ["org", companyId],
    queryFn: () => api.orgTree(companyId),
    refetchInterval: 15000,
  });
}

export function useLiveRuns(companyId: string): UseQueryResult<LiveRun[]> {
  return useQuery({
    queryKey: ["live-runs", companyId],
    queryFn: () => api.liveRuns(companyId),
    refetchInterval: 5000,
  });
}

export function useAgentRuns(companyId: string, agentId: string): UseQueryResult<LiveRun[]> {
  return useQuery({
    queryKey: ["agent-runs", companyId, agentId],
    queryFn: () => api.heartbeatRuns(companyId, { agentId, limit: 12 }),
    refetchInterval: 6000,
    enabled: !!companyId && !!agentId,
  });
}

export function useActivity(companyId: string): UseQueryResult<ActivityEntry[]> {
  return useQuery({
    queryKey: ["activity", companyId],
    queryFn: () => api.activity(companyId),
    refetchInterval: 8000,
  });
}

export function useApprovals(companyId: string): UseQueryResult<Approval[]> {
  return useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => api.listApprovals(companyId),
    refetchInterval: 8000,
  });
}

export function useIssues(companyId: string): UseQueryResult<Issue[]> {
  return useQuery({
    queryKey: ["issues", companyId],
    queryFn: () => api.listIssues(companyId),
    refetchInterval: 10000,
  });
}

// --- run transcript -------------------------------------------------------

export function useRun(runId: string): UseQueryResult<HeartbeatRun> {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId),
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : 2500),
  });
}

/** Polls run events while the run is live. Returns the full ordered list. */
export function useRunEvents(runId: string, live: boolean): UseQueryResult<HeartbeatRunEvent[]> {
  return useQuery({
    queryKey: ["run-events", runId],
    queryFn: () => api.runEvents(runId, 0, 500),
    refetchInterval: live ? 2000 : false,
  });
}

// --- mutations ------------------------------------------------------------

export function useAgentActions(agentId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agent", agentId] });
    qc.invalidateQueries({ queryKey: ["agents"] });
  };
  const pause = useMutation({ mutationFn: () => api.pauseAgent(agentId), onSuccess: invalidate });
  const resume = useMutation({ mutationFn: () => api.resumeAgent(agentId), onSuccess: invalidate });
  return { pause, resume };
}

export function useApprovalActions(companyId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["approvals", companyId] });
  const approve = useMutation({
    mutationFn: (id: string) => api.approve(id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.reject(id),
    onSuccess: invalidate,
  });
  return { approve, reject };
}

export function useCancelRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelRun(runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });
}
