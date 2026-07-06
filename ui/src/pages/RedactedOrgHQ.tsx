import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import {
  ArrowLeft,
  Bot,
  Building2,
  CircleDot,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { instanceDashboardApi } from "../api/instanceDashboard";
import { useCompany } from "../context/CompanyContext";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { OversightChat } from "../components/OversightChat";
import { OversightCall } from "../components/OversightCall";
import { useVoiceChatEnabled } from "../hooks/useVoiceChatEnabled";
import { cn, formatCents } from "../lib/utils";

type HqTab = "overview" | "chat" | "call";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px border-b-2 px-1 py-3 text-sm font-medium transition-colors",
        active
          ? "border-teal text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function HqOverview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["instanceDashboard"],
    queryFn: () => instanceDashboardApi.summary(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <PageSkeleton variant="dashboard" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState icon={Building2} message="Couldn't load the cross-company overview." />
    );
  }

  if (data.companies.length === 0) {
    return <EmptyState icon={Building2} message="No companies yet in this instance." />;
  }

  const { totals } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
      {/* Portfolio totals */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Building2} value={totals.companies} label="Companies" />
        <MetricCard
          icon={CircleDot}
          value={totals.tasks.open}
          label="Open tasks"
          description={`${totals.tasks.blocked} blocked`}
        />
        <MetricCard
          icon={Bot}
          value={totals.agents.active + totals.agents.running}
          label="Agents active"
          description={`${totals.agents.paused} paused · ${totals.agents.error} error`}
        />
        <MetricCard
          icon={ShieldCheck}
          value={totals.pendingApprovals}
          label="Approvals waiting"
        />
        <MetricCard
          icon={DollarSign}
          value={formatCents(totals.costs.monthSpendCents)}
          label="Spend this month"
          description={`of ${formatCents(totals.costs.monthBudgetCents)} budget`}
        />
      </div>

      {/* Per-company cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Companies</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.companies.map(({ company, summary }) => {
            const needsAttention = summary.tasks.blocked + summary.pendingApprovals;
            const attention =
              needsAttention > 0
                ? ` · ⚠ ${summary.tasks.blocked} blocked, ${summary.pendingApprovals} approvals`
                : "";
            return (
              <MetricCard
                key={company.id}
                icon={Building2}
                value={summary.tasks.open}
                label={`${company.name} (${company.issuePrefix})`}
                description={`${summary.agents.active + summary.agents.running} agents · ${formatCents(
                  summary.costs.monthSpendCents,
                )} spent${attention}`}
                to={`/${company.issuePrefix}/dashboard`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * <REDACTED_ORG> HQ — the instance-wide oversight destination (Mergatroid). Renders as a full-page
 * takeover (the `/hq` route is global, so there is no company Layout/Sidebar around it). Two regions:
 * a cross-company Overview and the Conference Room chat with Mergatroid.
 */
export function RedactedOrgHQ() {
  const { selectedCompany } = useCompany();
  const { enabled: voiceEnabled } = useVoiceChatEnabled();
  const [tab, setTab] = useState<HqTab>("overview");

  useEffect(() => {
    const prev = document.title;
    document.title = "<REDACTED_ORG> — HQ";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal/12 text-teal">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold"><REDACTED_ORG></h1>
            <p className="text-xs text-muted-foreground">Portfolio oversight · Mergatroid</p>
          </div>
        </div>
        {selectedCompany ? (
          <Link
            to={`/${selectedCompany.issuePrefix}/dashboard`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to {selectedCompany.name}</span>
            <span className="sm:hidden">Back</span>
          </Link>
        ) : null}
      </header>

      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </TabButton>
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>
          Conference Room
        </TabButton>
        {voiceEnabled ? (
          <TabButton active={tab === "call"} onClick={() => setTab("call")}>
            Call
          </TabButton>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "overview" ? (
          <div className="h-full overflow-y-auto">
            <HqOverview />
          </div>
        ) : tab === "call" && voiceEnabled ? (
          <OversightCall />
        ) : tab === "call" ? (
          // Voice was disabled while the tab was open — fall back to the text room.
          <OversightChat />
        ) : (
          <OversightChat />
        )}
      </div>
    </div>
  );
}
