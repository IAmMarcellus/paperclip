/**
 * Data hooks (TanStack Query) over the Paperclip API. List hooks poll while the
 * screen is mounted; the run hooks poll faster until the run reaches a terminal
 * status.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ActivityEntry,
  Agent,
  AgentDetail,
  Approval,
  Artifact,
  CostSummary,
  ExecutionWorkspace,
  Goal,
  HeartbeatRun,
  HeartbeatRunEvent,
  Issue,
  IssueComment,
  IssueLabel,
  LiveRun,
  OrgNode,
  Project,
  Routine,
  SidebarBadges,
  ThreadComment,
} from "@/lib/api/types";

const ISSUES_PAGE = 50;

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

/** Infinite, offset-paginated issues for the Tasks list. */
export function useIssuesInfinite(
  companyId: string,
  filters: Record<string, string | number> = {},
): UseInfiniteQueryResult<{ pages: Issue[][] }> {
  const key = JSON.stringify(filters);
  return useInfiniteQuery({
    queryKey: ["issues-infinite", companyId, key],
    enabled: !!companyId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.listIssues(companyId, {
        ...filters,
        limit: ISSUES_PAGE,
        offset: pageParam as number,
        sortField: "updated",
        sortDir: "desc",
      }),
    getNextPageParam: (last: Issue[], all: Issue[][]) =>
      last.length === ISSUES_PAGE ? all.length * ISSUES_PAGE : undefined,
    refetchInterval: 12000,
  }) as UseInfiniteQueryResult<{ pages: Issue[][] }>;
}

// --- issue detail ---------------------------------------------------------

export function useIssue(id: string): UseQueryResult<Issue> {
  return useQuery({ queryKey: ["issue", id], queryFn: () => api.getIssue(id), refetchInterval: 8000 });
}

export function useIssueComments(id: string): UseQueryResult<IssueComment[]> {
  return useQuery({
    queryKey: ["issue-comments", id],
    queryFn: () => api.issueComments(id, { limit: 100, order: "asc" }),
    refetchInterval: 4000,
  });
}

export function useIssueRuns(id: string): UseQueryResult<LiveRun[]> {
  return useQuery({
    queryKey: ["issue-runs", id],
    queryFn: () => api.issueRuns(id),
    refetchInterval: 4000,
  });
}

export function useIssueActivity(id: string): UseQueryResult<ActivityEntry[]> {
  return useQuery({ queryKey: ["issue-activity", id], queryFn: () => api.issueActivity(id) });
}

export function useIssueCostSummary(id: string): UseQueryResult<CostSummary> {
  return useQuery({ queryKey: ["issue-cost", id], queryFn: () => api.issueCostSummary(id) });
}

export function useIssueApprovals(id: string): UseQueryResult<Approval[]> {
  return useQuery({ queryKey: ["issue-approvals", id], queryFn: () => api.issueApprovals(id) });
}

export function useLabels(companyId: string): UseQueryResult<IssueLabel[]> {
  return useQuery({
    queryKey: ["labels", companyId],
    queryFn: () => api.labels(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

/** Mutations for an issue: post comment, patch fields, (un)assign. */
export function useIssueActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["issue", id] });
    qc.invalidateQueries({ queryKey: ["issue-comments", id] });
    qc.invalidateQueries({ queryKey: ["issue-runs", id] });
    qc.invalidateQueries({ queryKey: ["issues-infinite"] });
  };
  const postComment = useMutation({
    mutationFn: (input: { body: string; reopen?: boolean; interrupt?: boolean }) =>
      api.addComment(id, input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.updateIssue(id, patch),
    onSuccess: invalidate,
  });
  return { postComment, update };
}

export function useCreateIssue(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createIssue(companyId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issues-infinite", companyId] }),
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

// --- inbox / approval detail ----------------------------------------------

export function useSidebarBadges(companyId: string): UseQueryResult<SidebarBadges> {
  return useQuery({
    queryKey: ["sidebar-badges", companyId],
    queryFn: () => api.sidebarBadges(companyId),
    enabled: !!companyId,
    refetchInterval: 15000,
  });
}

export function useApproval(id: string): UseQueryResult<Approval> {
  return useQuery({ queryKey: ["approval", id], queryFn: () => api.getApproval(id), refetchInterval: 8000 });
}

export function useApprovalComments(id: string): UseQueryResult<ThreadComment[]> {
  return useQuery({
    queryKey: ["approval-comments", id],
    queryFn: () => api.approvalComments(id),
    refetchInterval: 6000,
  });
}

export function useApprovalIssues(id: string): UseQueryResult<Issue[]> {
  return useQuery({ queryKey: ["approval-issues", id], queryFn: () => api.approvalIssues(id) });
}

/** Approve / reject / comment from the approval detail screen. */
export function useApprovalDetailActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["approval", id] });
    qc.invalidateQueries({ queryKey: ["approval-comments", id] });
    qc.invalidateQueries({ queryKey: ["approvals"] });
    qc.invalidateQueries({ queryKey: ["sidebar-badges"] });
  };
  const approve = useMutation({ mutationFn: () => api.approve(id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => api.reject(id), onSuccess: invalidate });
  const comment = useMutation({
    mutationFn: (text: string) => api.addApprovalComment(id, { text }),
    onSuccess: invalidate,
  });
  return { approve, reject, comment };
}

export function useCancelRun(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelRun(runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["run", runId] }),
  });
}

// --- More hub: projects / goals / routines / costs / search / etc. --------

export function useProjects(companyId: string): UseQueryResult<Project[]> {
  return useQuery({ queryKey: ["projects", companyId], queryFn: () => api.listProjects(companyId), enabled: !!companyId });
}
export function useProject(id: string): UseQueryResult<Project> {
  return useQuery({ queryKey: ["project", id], queryFn: () => api.getProject(id) });
}
export function useCreateProject(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createProject(companyId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", companyId] }),
  });
}
export function useProjectIssues(companyId: string, projectId: string): UseQueryResult<Issue[]> {
  return useQuery({
    queryKey: ["project-issues", companyId, projectId],
    queryFn: () => api.listIssues(companyId, { projectId, limit: 100 }),
    enabled: !!companyId && !!projectId,
  });
}

export function useGoals(companyId: string): UseQueryResult<Goal[]> {
  return useQuery({ queryKey: ["goals", companyId], queryFn: () => api.listGoals(companyId), enabled: !!companyId });
}
export function useGoal(id: string): UseQueryResult<Goal> {
  return useQuery({ queryKey: ["goal", id], queryFn: () => api.getGoal(id) });
}
export function useCreateGoal(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.createGoal(companyId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", companyId] }),
  });
}

export function useRoutines(companyId: string): UseQueryResult<Routine[]> {
  return useQuery({ queryKey: ["routines", companyId], queryFn: () => api.listRoutines(companyId), enabled: !!companyId });
}
export function useRunRoutine() {
  return useMutation({ mutationFn: (id: string) => api.runRoutine(id) });
}

export function useCostsSummary(companyId: string): UseQueryResult<CostSummary> {
  return useQuery({ queryKey: ["costs", companyId], queryFn: () => api.costsSummary(companyId), enabled: !!companyId });
}
export function useCostsBy(
  companyId: string,
  dim: "agent" | "provider" | "model",
): UseQueryResult<Record<string, unknown>[]> {
  return useQuery({
    queryKey: ["costs-by", companyId, dim],
    queryFn: () => api.costsBy(companyId, dim),
    enabled: !!companyId,
  });
}

export function useSearch(companyId: string, q: string): UseQueryResult<unknown> {
  return useQuery({
    queryKey: ["search", companyId, q],
    queryFn: () => api.search(companyId, q),
    enabled: !!companyId && q.trim().length > 1,
  });
}

export function useArtifacts(companyId: string): UseQueryResult<Artifact[]> {
  return useQuery({ queryKey: ["artifacts", companyId], queryFn: () => api.artifacts(companyId), enabled: !!companyId });
}

export function useExecutionWorkspaces(companyId: string): UseQueryResult<ExecutionWorkspace[]> {
  return useQuery({
    queryKey: ["exec-workspaces", companyId],
    queryFn: () => api.executionWorkspaces(companyId),
    enabled: !!companyId,
  });
}

export function useUserProfile(companyId: string, slug: string): UseQueryResult<Record<string, unknown>> {
  return useQuery({
    queryKey: ["user-profile", companyId, slug],
    queryFn: () => api.userProfile(companyId, slug),
    enabled: !!companyId && !!slug,
  });
}
