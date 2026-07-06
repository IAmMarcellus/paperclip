import type { DashboardSummary } from "@paperclipai/shared";
import { api } from "./client";

export interface InstanceDashboardCompany {
  company: {
    id: string;
    name: string;
    issuePrefix: string;
    status: string;
    brandColor: string | null;
  };
  summary: DashboardSummary;
}

export interface InstanceDashboard {
  generatedAt: string;
  companies: InstanceDashboardCompany[];
  totals: {
    companies: number;
    agents: { active: number; running: number; paused: number; error: number };
    tasks: { open: number; inProgress: number; blocked: number; done: number };
    costs: { monthSpendCents: number; monthBudgetCents: number };
    pendingApprovals: number;
  };
}

export const instanceDashboardApi = {
  // Cross-company ("<REDACTED_ORG>") overview. Bucket run-activity by the viewer's local day.
  summary: () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
    return api.get<InstanceDashboard>(`/instance/dashboard${query}`);
  },
};
