import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { companyService, dashboardService } from "../services/index.js";
import { assertInstanceAdmin } from "./authz.js";

/**
 * Cross-company ("<REDACTED_ORG>") overview for the instance-wide oversight surface.
 *
 * Reuses the per-company dashboard summary for every accessible company and aggregates totals — no
 * new query logic. Instance-admin only (the local_trusted board actor); never exposed to a
 * company-scoped agent.
 */
export function instanceDashboardRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const dashboards = dashboardService(db);

  router.get("/instance/dashboard", async (req, res) => {
    assertInstanceAdmin(req);
    const timeZone = typeof req.query.tz === "string" ? req.query.tz : undefined;
    const all = await companies.list();

    const rows = await Promise.all(
      all.map(async (company) => ({
        company: {
          id: company.id,
          name: company.name,
          issuePrefix: company.issuePrefix,
          status: company.status,
          brandColor: company.brandColor ?? null,
        },
        summary: await dashboards.summary(company.id, { timeZone }),
      })),
    );

    const totals = rows.reduce(
      (acc, { summary }) => {
        acc.agents.active += summary.agents.active;
        acc.agents.running += summary.agents.running;
        acc.agents.paused += summary.agents.paused;
        acc.agents.error += summary.agents.error;
        acc.tasks.open += summary.tasks.open;
        acc.tasks.inProgress += summary.tasks.inProgress;
        acc.tasks.blocked += summary.tasks.blocked;
        acc.tasks.done += summary.tasks.done;
        acc.costs.monthSpendCents += summary.costs.monthSpendCents;
        acc.costs.monthBudgetCents += summary.costs.monthBudgetCents;
        acc.pendingApprovals += summary.pendingApprovals;
        return acc;
      },
      {
        companies: rows.length,
        agents: { active: 0, running: 0, paused: 0, error: 0 },
        tasks: { open: 0, inProgress: 0, blocked: 0, done: 0 },
        costs: { monthSpendCents: 0, monthBudgetCents: 0 },
        pendingApprovals: 0,
      },
    );

    res.json({ generatedAt: new Date().toISOString(), companies: rows, totals });
  });

  return router;
}
