import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, costEvents, heartbeatRuns, issues } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

const DASHBOARD_RUN_ACTIVITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// Falls back to UTC for an unset/invalid IANA zone so callers can pass the
// browser timezone through without validating it themselves. The character
// whitelist plus Intl acceptance keeps the value safe to inline as a SQL
// literal (see runActivityDayExpr).
function resolveTimeZone(timeZone?: string): string {
  if (!timeZone || !/^[A-Za-z0-9/_+-]+$/.test(timeZone)) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

// The calendar date (YYYY-MM-DD) that `date` falls on in `timeZone`. en-CA
// formats as an ISO-style YYYY-MM-DD, which is exactly the bucket key we want.
function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The last `days` calendar dates ending on "today" in `timeZone`. We anchor each
// step at noon so a ±1h DST shift can never slip the label to an adjacent day.
function getRecentLocalDateKeys(now: Date, days: number, timeZone: string): string[] {
  const [year, month, day] = getLocalDateKey(now, timeZone).split("-").map(Number);
  const todayNoonUtc = Date.UTC(year, month - 1, day, 12);
  return Array.from({ length: days }, (_, index) => {
    const dayOffset = index - (days - 1);
    return new Date(todayNoonUtc + dayOffset * DAY_MS).toISOString().slice(0, 10);
  });
}

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string, options?: { timeZone?: string }) => {
      const timeZone = resolveTimeZone(options?.timeZone);
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = getUtcMonthStart(now);
      const runActivityDays = getRecentLocalDateKeys(now, DASHBOARD_RUN_ACTIVITY_DAYS, timeZone);
      // Widen the lower bound by a day so rows near the earliest local-day
      // boundary aren't dropped by the UTC-keyed range filter (max tz offset < 24h);
      // rows outside the 14 local-day window simply match no bucket below.
      const runActivityStart = new Date(
        new Date(`${runActivityDays[0]}T00:00:00.000Z`).getTime() - DAY_MS,
      );
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      // Inline the (whitelisted) zone as a SQL literal rather than a bound
      // param: this expression is repeated verbatim in SELECT and GROUP BY, and
      // two distinct placeholders ($1 vs $4) would defeat Postgres's GROUP BY
      // expression matching.
      const tzLiteral = sql.raw(`'${timeZone}'`);
      const runActivityDayExpr = sql<string>`to_char(${heartbeatRuns.createdAt} at time zone ${tzLiteral}, 'YYYY-MM-DD')`;
      const runActivityRows = await db
        .select({
          date: runActivityDayExpr,
          status: heartbeatRuns.status,
          count: sql<number>`count(*)::double precision`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.createdAt, runActivityStart),
          ),
        )
        .groupBy(runActivityDayExpr, heartbeatRuns.status);

      const runActivity = new Map(
        runActivityDays.map((date) => [
          date,
          { date, succeeded: 0, failed: 0, other: 0, total: 0 },
        ]),
      );
      for (const row of runActivityRows) {
        const bucket = runActivity.get(row.date);
        if (!bucket) continue;
        const count = Number(row.count);
        if (row.status === "succeeded") bucket.succeeded += count;
        else if (row.status === "failed" || row.status === "timed_out") bucket.failed += count;
        else bucket.other += count;
        bucket.total += count;
      }

      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
        runActivity: Array.from(runActivity.values()),
      };
    },

    /**
     * "What needs your eye" detail that complements `summary`'s counts: the most-recently-touched
     * blocked issues (identifier + title, capped) and the names of agents currently in error. Two
     * small indexed lookups (issues_company_status_idx / agents.companyId) — cheap enough to fan out
     * per company for the oversight voice snapshot so spoken follow-ups ("pull up the blocked tasks",
     * "are the agents still erroring?") answer without a round of API tool-calls.
     */
    attention: async (companyId: string, options?: { blockedLimit?: number }) => {
      const blockedLimit = Math.max(0, options?.blockedLimit ?? 5);
      const blockedRows = await db
        .select({ identifier: issues.identifier, title: issues.title })
        .from(issues)
        .where(and(eq(issues.companyId, companyId), eq(issues.status, "blocked")))
        .orderBy(desc(issues.updatedAt))
        .limit(blockedLimit + 1); // +1 row to detect "and N more" without a second count query
      const errorAgentRows = await db
        .select({ name: agents.name })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.status, "error")))
        .orderBy(agents.name);
      return {
        blocked: blockedRows
          .slice(0, blockedLimit)
          .map((r) => ({ identifier: r.identifier, title: r.title })),
        blockedHasMore: blockedRows.length > blockedLimit,
        errorAgents: errorAgentRows.map((r) => r.name),
      };
    },
  };
}
