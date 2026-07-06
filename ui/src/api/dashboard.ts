import type { DashboardSummary } from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => {
    // Bucket run-activity / success-rate by the viewer's local day, not UTC.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
    return api.get<DashboardSummary>(`/companies/${companyId}/dashboard${query}`);
  },
};
