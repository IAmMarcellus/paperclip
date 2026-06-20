/**
 * Paperclip API — typed endpoint functions grouped by resource. All read
 * baseUrl/token from apiConfig via apiFetch (lib/api/client.ts).
 */
import { apiFetch, type RequestOptions } from "./client";
import type {
  Agent,
  AgentDetail,
  AgentWakeupResponse,
  Approval,
  AuthSession,
  Company,
  HeartbeatRun,
  HeartbeatRunEvent,
  Issue,
  LiveRun,
  OrgNode,
  ActivityEntry,
  RunLog,
} from "./types";

export const api = {
  // --- auth / companies -------------------------------------------------
  getSession: (opts?: RequestOptions) => apiFetch<AuthSession>("/auth/get-session", opts),
  listCompanies: (opts?: RequestOptions) => apiFetch<Company[]>("/companies", opts),

  // --- agents -----------------------------------------------------------
  listAgents: (companyId: string) =>
    apiFetch<Agent[]>(`/companies/${companyId}/agents`),
  getAgent: (id: string) => apiFetch<AgentDetail>(`/agents/${id}`),
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

  // --- approvals --------------------------------------------------------
  listApprovals: (companyId: string) =>
    apiFetch<Approval[]>(`/companies/${companyId}/approvals`),
  approve: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<Approval>(`/approvals/${id}/approve`, { method: "POST", body }),
  reject: (id: string, body: Record<string, unknown> = {}) =>
    apiFetch<Approval>(`/approvals/${id}/reject`, { method: "POST", body }),

  // --- activity ---------------------------------------------------------
  activity: (companyId: string, limit = 30) =>
    apiFetch<ActivityEntry[]>(`/companies/${companyId}/activity`, { query: { limit } }),
};

export { ApiError } from "./client";
export type * from "./types";
