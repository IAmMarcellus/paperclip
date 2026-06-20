/**
 * Paperclip API — typed endpoint functions grouped by resource. All read
 * baseUrl/token from apiConfig via apiFetch (lib/api/client.ts).
 */
import { apiFetch, type RequestOptions } from "./client";
import type {
  AdapterInfo,
  Agent,
  AgentDetail,
  AgentWakeupResponse,
  Approval,
  Artifact,
  AuthSession,
  Company,
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
  ActivityEntry,
  Project,
  Routine,
  RunLog,
  SidebarBadges,
  ThreadComment,
} from "./types";

export const api = {
  // --- auth / companies -------------------------------------------------
  getSession: (opts?: RequestOptions) => apiFetch<AuthSession>("/auth/get-session", opts),
  listCompanies: (opts?: RequestOptions) => apiFetch<Company[]>("/companies", opts),

  // --- agents -----------------------------------------------------------
  listAgents: (companyId: string) =>
    apiFetch<Agent[]>(`/companies/${companyId}/agents`),
  getAgent: (id: string) => apiFetch<AgentDetail>(`/agents/${id}`),
  createAgent: (companyId: string, body: Record<string, unknown>) =>
    apiFetch<Agent>(`/companies/${companyId}/agents`, { method: "POST", body }),
  adapters: () => apiFetch<AdapterInfo[]>("/adapters"),
  orgTree: (companyId: string) => apiFetch<OrgNode[]>(`/companies/${companyId}/org`),
  pauseAgent: (id: string) => apiFetch<Agent>(`/agents/${id}/pause`, { method: "POST" }),
  resumeAgent: (id: string) => apiFetch<Agent>(`/agents/${id}/resume`, { method: "POST" }),
  terminateAgent: (id: string) =>
    apiFetch<Agent>(`/agents/${id}/terminate`, { method: "POST" }),
  wakeAgent: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<AgentWakeupResponse>(`/agents/${id}/wakeup`, { method: "POST", body }),

  // --- runs (heartbeat) -------------------------------------------------
  liveRuns: (companyId: string, limit = 50) =>
    apiFetch<LiveRun[]>(`/companies/${companyId}/live-runs`, { query: { limit } }),
  heartbeatRuns: (companyId: string, opts: { agentId?: string; limit?: number } = {}) =>
    apiFetch<LiveRun[]>(`/companies/${companyId}/heartbeat-runs`, {
      query: { agentId: opts.agentId, limit: opts.limit ?? 20 },
    }),
  getRun: (runId: string) => apiFetch<HeartbeatRun>(`/heartbeat-runs/${runId}`),
  runEvents: (runId: string, afterSeq = 0, limit = 200) =>
    apiFetch<HeartbeatRunEvent[]>(`/heartbeat-runs/${runId}/events`, {
      query: { afterSeq, limit },
    }),
  runLog: (runId: string, offset = 0, limitBytes = 262144) =>
    apiFetch<RunLog>(`/heartbeat-runs/${runId}/log`, { query: { offset, limitBytes } }),
  cancelRun: (runId: string) =>
    apiFetch<void>(`/heartbeat-runs/${runId}/cancel`, { method: "POST" }),

  // --- issues -----------------------------------------------------------
  listIssues: (companyId: string, query: Record<string, string | number> = {}) =>
    apiFetch<Issue[]>(`/companies/${companyId}/issues`, { query }),
  getIssue: (id: string) => apiFetch<Issue>(`/issues/${id}`),
  createIssue: (companyId: string, body: Record<string, unknown>) =>
    apiFetch<Issue>(`/companies/${companyId}/issues`, { method: "POST", body }),
  updateIssue: (id: string, body: Record<string, unknown>) =>
    apiFetch<Issue>(`/issues/${id}`, { method: "PATCH", body }),
  issueComments: (id: string, query: Record<string, string | number> = {}) =>
    apiFetch<IssueComment[]>(`/issues/${id}/comments`, { query }),
  addComment: (
    id: string,
    body: { body: string; reopen?: boolean; interrupt?: boolean },
  ) => apiFetch<IssueComment>(`/issues/${id}/comments`, { method: "POST", body }),
  checkoutIssue: (id: string, body: Record<string, unknown>) =>
    apiFetch<Issue>(`/issues/${id}/checkout`, { method: "POST", body }),
  releaseIssue: (id: string) => apiFetch<Issue>(`/issues/${id}/release`, { method: "POST" }),
  issueActivity: (id: string) => apiFetch<ActivityEntry[]>(`/issues/${id}/activity`),
  issueRuns: (id: string) => apiFetch<LiveRun[]>(`/issues/${id}/runs`),
  issueCostSummary: (id: string) => apiFetch<CostSummary>(`/issues/${id}/cost-summary`),
  issueApprovals: (id: string) => apiFetch<Approval[]>(`/issues/${id}/approvals`),
  labels: (companyId: string) => apiFetch<IssueLabel[]>(`/companies/${companyId}/labels`),

  // --- approvals --------------------------------------------------------
  listApprovals: (companyId: string) =>
    apiFetch<Approval[]>(`/companies/${companyId}/approvals`),
  getApproval: (id: string) => apiFetch<Approval>(`/approvals/${id}`),
  approvalComments: (id: string) => apiFetch<ThreadComment[]>(`/approvals/${id}/comments`),
  addApprovalComment: (id: string, body: { text: string }) =>
    apiFetch<ThreadComment>(`/approvals/${id}/comments`, { method: "POST", body }),
  approvalIssues: (id: string) => apiFetch<Issue[]>(`/approvals/${id}/issues`),
  approve: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<Approval>(`/approvals/${id}/approve`, { method: "POST", body }),
  reject: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<Approval>(`/approvals/${id}/reject`, { method: "POST", body }),

  // --- inbox / badges ---------------------------------------------------
  sidebarBadges: (companyId: string) =>
    apiFetch<SidebarBadges>(`/companies/${companyId}/sidebar-badges`),

  // --- activity ---------------------------------------------------------
  activity: (companyId: string, limit = 30) =>
    apiFetch<ActivityEntry[]>(`/companies/${companyId}/activity`, { query: { limit } }),

  // --- projects ---------------------------------------------------------
  listProjects: (companyId: string) => apiFetch<Project[]>(`/companies/${companyId}/projects`),
  getProject: (id: string) => apiFetch<Project>(`/projects/${id}`),
  createProject: (companyId: string, body: Record<string, unknown>) =>
    apiFetch<Project>(`/companies/${companyId}/projects`, { method: "POST", body }),

  // --- goals ------------------------------------------------------------
  listGoals: (companyId: string) => apiFetch<Goal[]>(`/companies/${companyId}/goals`),
  getGoal: (id: string) => apiFetch<Goal>(`/goals/${id}`),
  createGoal: (companyId: string, body: Record<string, unknown>) =>
    apiFetch<Goal>(`/companies/${companyId}/goals`, { method: "POST", body }),

  // --- routines ---------------------------------------------------------
  listRoutines: (companyId: string) => apiFetch<Routine[]>(`/companies/${companyId}/routines`),
  runRoutine: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<unknown>(`/routines/${id}/run`, { method: "POST", body }),

  // --- costs ------------------------------------------------------------
  costsSummary: (companyId: string) =>
    apiFetch<CostSummary>(`/companies/${companyId}/costs/summary`),
  costsBy: (companyId: string, dim: "agent" | "provider" | "model") =>
    apiFetch<Record<string, unknown>[]>(`/companies/${companyId}/costs/by-${dim}`),

  // --- search / artifacts / workspaces / profile ------------------------
  search: (companyId: string, q: string) =>
    apiFetch<unknown>(`/companies/${companyId}/search`, { query: { q } }),
  artifacts: (companyId: string) => apiFetch<Artifact[]>(`/companies/${companyId}/artifacts`),
  executionWorkspaces: (companyId: string) =>
    apiFetch<ExecutionWorkspace[]>(`/companies/${companyId}/execution-workspaces`),
  userProfile: (companyId: string, slug: string) =>
    apiFetch<Record<string, unknown>>(`/companies/${companyId}/users/${slug}/profile`),
};

export { ApiError } from "./client";
export type * from "./types";
